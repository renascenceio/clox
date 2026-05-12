import { streamText, createDataStreamResponse } from 'ai'
import { resolveLanguageModel, AIProvider } from '@/domains/text-generation/services/model-router'
import { assertBudget } from '@/lib/projects/server'
import { loadSkillCatalog, buildSkillIndex } from '@/lib/skills-index'
import { makeReadSkillTool } from '@/lib/tools/read-skill'
import { compactTranscript } from '@/lib/transcript-compact'
import { recordUsage, getCallerForLogging } from '@/lib/projects/usage'
import { webSearchTool } from '@/lib/tools/web-search'
import { runJavaScriptTool } from '@/lib/tools/run-javascript'
import { makeBashTool } from '@/lib/tools/sandbox-bash'
import { makePythonTool } from '@/lib/tools/sandbox-python'
import { mountAttachments, collectOutputs, prewarmSandbox, type AttachmentToMount } from '@/lib/sandbox/manager'
import { uploadChatOutput } from '@/lib/storage/chat-outputs'

// Streaming chat responses can legitimately run for several minutes
// when the python sandbox is in play: cold microVM boot (~5-10s), pip
// install of the canonical package set on first call (~30-40s), then
// the actual work — generating a multi-slide PPT with python-pptx,
// rendering charts via pillow, etc., can take another 30-60s. Keeping
// this at the previous 60s cap caused the function to be killed mid-
// stream, so the user saw "stuck" with no progress and no error.
// 300 seconds is the maximum allowed on Vercel Pro for streaming
// functions; anything below that is a footgun for the document-
// handling skills.
export const maxDuration = 300

interface IncomingAttachment {
  name?: string
  contentType?: string
  url?: string
}

interface IncomingMessage {
  role: string
  content: unknown
  experimental_attachments?: IncomingAttachment[]
}

// Cap inlined text at 80KB per attachment so a 5MB log file doesn't
// blow out the model's context window or our token budget. The cap is
// generous enough to fit a normal CSV / markdown / source file but
// strict enough to protect against pathological uploads. We always
// note the truncation in the inlined block so the model can ask for
// more if it matters.
const INLINE_TEXT_CAP_BYTES = 80 * 1024

/** Pull the raw bytes out of a `data:` URL. Returns null for malformed
 *  URLs. Used by both the text-decode and the binary-decode paths. */
function dataUrlToBuffer(url: string): { mime: string; buf: Buffer } | null {
  if (!url.startsWith('data:')) return null
  const comma = url.indexOf(',')
  if (comma === -1) return null
  const meta = url.slice(5, comma)
  const payload = url.slice(comma + 1)
  const mime = meta.split(';')[0] || 'application/octet-stream'
  try {
    if (meta.includes(';base64')) {
      return { mime, buf: Buffer.from(payload, 'base64') }
    }
    return { mime, buf: Buffer.from(decodeURIComponent(payload), 'utf8') }
  } catch {
    return null
  }
}

/**
 * Extract readable text from an Office / PDF binary attachment.
 *
 * Supported types:
 *   - .docx  (mammoth, raw text)
 *   - .xlsx / .xls / .ods (SheetJS, CSV per sheet)
 *   - .pdf   (pdfjs-dist, page-by-page text)
 *
 * The result is plain UTF-8 text the model can read inline. We cap
 * each extraction at the same `INLINE_TEXT_CAP_BYTES` ceiling we use
 * for raw text uploads so a 200-page PDF doesn't blow the prompt.
 */
async function extractBinaryText(mime: string, name: string, buf: Buffer): Promise<string | null> {
  // .docx — mammoth gives us clean paragraph text.
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.docx$/i.test(name)
  ) {
    try {
      const mammoth = await import('mammoth')
      const out = await mammoth.extractRawText({ buffer: buf })
      return capInlineText(out.value || '')
    } catch (e) {
      console.error('[v0] docx extract failed', e)
      return null
    }
  }

  // Spreadsheets — SheetJS reads xlsx, xls, ods, and a handful of
  // legacy formats. We emit one CSV block per sheet so the model
  // reasons about the workbook structure naturally.
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    /\.(xlsx|xls|ods)$/i.test(name)
  ) {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buf, { type: 'buffer' })
      const blocks = wb.SheetNames.map((sheetName: string) => {
        const sheet = wb.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        return `### Sheet: ${sheetName}\n\`\`\`csv\n${csv}\n\`\`\``
      })
      return capInlineText(blocks.join('\n\n'))
    } catch (e) {
      console.error('[v0] xlsx extract failed', e)
      return null
    }
  }

  // .pdf — pdfjs-dist runs on Node when we point it at the legacy
  // build. Text-only extraction is plenty for the model; for layout-
  // dependent docs the user will usually paste a screenshot anyway.
  if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      // The API route has no DOM and no Worker. pdfjs runs single-
      // threaded when `GlobalWorkerOptions.workerSrc` is left empty
      // and we pass plain init options; the type definitions don't
      // expose every legacy escape hatch (e.g. `disableWorker`), so
      // we cast through `unknown` to keep the overrides we actually
      // want without disabling the rest of the route's typing.
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buf),
        isEvalSupported: false,
        useSystemFonts: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      const pdf = await loadingTask.promise
      const pages: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const tc = await page.getTextContent()
        const text = (tc.items as Array<{ str?: string }>)
          .map(it => it.str ?? '')
          .join(' ')
        pages.push(`--- Page ${i} ---\n${text}`)
      }
      return capInlineText(pages.join('\n\n'))
    } catch (e) {
      console.error('[v0] pdf extract failed', e)
      return null
    }
  }

  return null
}

function capInlineText(s: string): string {
  if (s.length <= INLINE_TEXT_CAP_BYTES) return s
  return s.slice(0, INLINE_TEXT_CAP_BYTES) + '\n…[truncated]'
}

/**
 * Decode a `data:` URL containing UTF-8 text. Returns null for binary
 * payloads or malformed URLs. We deliberately accept only the data-url
 * shape useChat produces; remote URLs would need a separate fetch and
 * we prefer to keep the route side-effect-free.
 */
function decodeDataUrlAsText(url: string): string | null {
  if (!url.startsWith('data:')) return null
  const comma = url.indexOf(',')
  if (comma === -1) return null
  const meta = url.slice(5, comma) // e.g. "text/csv;base64"
  const payload = url.slice(comma + 1)
  try {
    if (meta.includes(';base64')) {
      // Buffer is the standard Node global in API routes; atob would also
      // work but Buffer handles the decode-to-utf8 step in one call.
      const buf = Buffer.from(payload, 'base64')
      if (buf.byteLength > INLINE_TEXT_CAP_BYTES) {
        return buf.subarray(0, INLINE_TEXT_CAP_BYTES).toString('utf8') + '\n…[truncated]'
      }
      return buf.toString('utf8')
    }
    return decodeURIComponent(payload)
  } catch {
    return null
  }
}

/**
 * True for content-types whose payload is plain text and worth inlining
 * into the prompt so the model can actually read the file. We err on
 * the side of inclusion: anything starting with `text/`, plus a short
 * allowlist of structured-text formats (JSON, CSV, YAML, XML, …) where
 * the type is `application/*` but the bytes are still UTF-8.
 */
function isInlineableTextType(ct: string): boolean {
  if (!ct) return false
  if (ct.startsWith('text/')) return true
  return /^application\/(json|xml|x-yaml|yaml|csv|x-csv|x-ndjson|x-sh|javascript|typescript)$/i
    .test(ct)
}

/** Convert a useChat message with `experimental_attachments` into the
 *  multimodal `content: ContentPart[]` shape that streamText expects.
 *
 *  This is async because Office / PDF extraction relies on dynamic
 *  imports of mammoth / pdfjs / xlsx — those libraries are several
 *  hundred KB each and we don't want them in the route's startup cost
 *  when no binary attachment is present. */
async function inflateAttachments(raw: unknown): Promise<unknown> {
  const m = raw as IncomingMessage
  const atts = m.experimental_attachments
  if (!Array.isArray(atts) || atts.length === 0) return m

  const text = typeof m.content === 'string' ? m.content : ''
  const parts: Array<Record<string, unknown>> = []

  if (text.trim().length > 0) parts.push({ type: 'text', text })

  for (const att of atts) {
    if (!att?.url) continue
    const ct = att.contentType ?? ''
    const name = att.name ?? 'file'
    if (ct.startsWith('image/')) {
      // streamText accepts both data URLs and remote URLs in the `image` field.
      parts.push({ type: 'image', image: att.url })
      continue
    }
    if (isInlineableTextType(ct)) {
      // Inline the decoded text so the model can actually read CSVs,
      // JSON files, source code, markdown notes, etc. Wrap each one in
      // a fenced block tagged with the filename + content-type so the
      // model can refer to it by name in its answer.
      const decoded = decodeDataUrlAsText(att.url)
      if (decoded == null) {
        parts.push({
          type: 'text',
          text: `[Attachment: ${name} (${ct}) — could not decode]`,
        })
        continue
      }
      parts.push({
        type: 'text',
        text: [
          `Attached file: ${name} (${ct})`,
          '```',
          decoded,
          '```',
        ].join('\n'),
      })
      continue
    }

    // Binary path — try to extract text from .docx / .xlsx / .pdf so
    // the model can analyse Office documents without bouncing through
    // a manual copy-paste step. Anything we can't extract falls back
    // to the name-only reference so the model at least knows it's
    // there.
    const decoded = dataUrlToBuffer(att.url)
    if (decoded) {
      const extracted = await extractBinaryText(decoded.mime || ct, name, decoded.buf)
      if (extracted != null) {
        parts.push({
          type: 'text',
          text: [
            `Attached file: ${name} (${ct || decoded.mime})`,
            extracted,
          ].join('\n'),
        })
        continue
      }
    }
    parts.push({
      type: 'text',
      text: `[Attachment: ${name} (${ct || 'application/octet-stream'})]`,
    })
  }

  // If we ended up with only one text part, return it as a string for
  // maximum compatibility with text-only models.
  if (parts.length === 1 && parts[0].type === 'text') {
    return { ...m, content: (parts[0] as { text: string }).text }
  }

  return { ...m, content: parts }
}

/**
 * Pull the raw bytes for every non-image attachment on every message
 * the client sent, deduped by `(name, size)`. We feed these to the
 * sandbox manager so the model can read them via the `bash` / `python`
 * tools at `/mnt/user-data/uploads/<name>`.
 *
 * Image attachments get rendered straight into the model's vision
 * channel by the existing `inflateAttachments` path — there's no
 * benefit to also writing them into the sandbox, so we skip them. */
function extractAttachmentBuffers(messages: unknown[]): AttachmentToMount[] {
  const out: AttachmentToMount[] = []
  const seen = new Set<string>()
  for (const raw of messages) {
    const m = raw as IncomingMessage
    const atts = m.experimental_attachments
    if (!Array.isArray(atts)) continue
    for (const att of atts) {
      if (!att?.url) continue
      const ct = att.contentType ?? ''
      if (ct.startsWith('image/')) continue
      const name = att.name ?? 'file'
      const decoded = dataUrlToBuffer(att.url)
      if (!decoded) continue
      const key = `${name}::${decoded.buf.byteLength}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        name,
        contentType: ct || decoded.mime,
        content: decoded.buf,
      })
    }
  }
  return out
}

/**
 * Baseline capabilities preamble injected ahead of the user's system
 * prompt on every chat request.
 *
 * Why this exists:
 *   Out of the box most models (Claude in particular) refuse to produce
 *   files, claiming they're "text-only" — which is technically true but
 *   useless to the user. In Clox the renderer turns every fenced code
 *   block into a downloadable artifact (Copy / Download / Preview),
 *   but the model has no way to know that. This preamble tells it
 *   exactly what the surface offers so it stops refusing and starts
 *   emitting structured output.
 *
 *   We deliberately keep this short, factual, and free of personality —
 *   model identity / tone is the user's system prompt's job.
 */
// Stable preamble. Compressed in late 2026 from ~3.5 KB to ~1.2 KB
// after the user kept hitting Anthropic's tier-1 10k input-TPM cap
// on first-turn requests. Every byte here ships on every Claude
// call (cached on hit, full-price on miss), and Sonnet 4.6 was
// blowing the per-minute budget on system prompt alone for fresh
// chats. The trimmed version keeps every BEHAVIORAL directive
// (don't refuse; ambiguous → ask; fence mapping; multi-artifact;
// reply structure) and drops the explanatory prose about WHY each
// rule exists. The skills and tool descriptions carry the deep
// guidance — including the per-format schemas, the chunking
// pattern, and the cost rationale — so duplicating it here was
// pure overhead.
const CLOX_CAPABILITIES_PREAMBLE = [
  'You are running inside Clox, a full-capability AI workspace. Fenced',
  'code blocks in your reply render as downloadable, previewable',
  'artifacts; document-shaped fences (pdf/docx/pptx/csv) build real',
  'binary Office/PDF exports. You CAN produce files — never refuse with',
  '"I can only output text".',
  '',
  'AMBIGUOUS REQUEST → ASK FIRST. If the user names a format with no',
  'topic, audience, or content brief (e.g. "Excel, Powerpoint and Docs",',
  '"Make a PDF"), reply with a SHORT clarifying question (≤3 lines).',
  'Do not call tools, do not load skills, do not generate placeholders.',
  '',
  'STRICT format-to-fence mapping:',
  '  HTML page / chart / mermaid → ```html  (full doc or fragment)',
  '  PDF                          → ```pdf   (markdown OR html body)',
  '  Word document / .docx        → ```docx  (markdown body)',
  '  Slide deck / .pptx           → ```pptx  (JSON outline)',
  '  Excel / multi-sheet          → ```csv   (one block per sheet,',
  '                                 each preceded by "### Sheet: <name>")',
  '  Single CSV                   → ```csv   (one block, no heading)',
  '  SVG diagram                  → ```svg',
  '  JSON data                    → ```json',
  '  Markdown / source code       → ```<lang>',
  '',
  'Pptx outline shape:',
  '  { "title": "…", "theme": { "background": "#…", "heading": "#…",',
  '    "body": "#…", "accent": "#…" }, "slides": [ … ] }',
  'Document specialists (pptx/pdf/docx/xlsx) auto-activate on intent and',
  'carry the full schema + palette + python-build guidance. Follow them.',
  '',
  'Multi-deliverable turns: emit ONE fenced block per requested format.',
  '',
  'Uploaded files are inlined earlier in the conversation under',
  '"Attached file: …" (plain text, source, JSON, YAML, CSV, markdown,',
  'Word, Excel, PDF). Read inline, analyse, answer concretely.',
  '',
  'Reply shape when emitting an artifact:',
  '  1. One short framing sentence.',
  '  2. The fenced artifact block(s).',
  '  3. One short summary line (what\'s inside, how to use it).',
  'Never end on the closing fence alone — the user expects acknowledgement.',
  '',
  'Defaults: produce the artifact (don\'t describe how to build it),',
  'populate real content (not TODOs), structure long docs with headings.',
].join('\n')

export async function POST(req: Request) {
  let requestData
  try {
    requestData = await req.json()
  } catch (e) {
    console.error('[v0] Failed to parse chat request body:', e)
    return new Response('Invalid request body', { status: 400 })
  }

  const {
    messages,
    model,
    provider,
    temperature = 0.7,
    maxTokens = 2048,
    systemPrompt,
    apiKey,
    projectId,
    chatId,
    tools: requestedTools,
  }: {
    messages: unknown[]
    model: string
    provider: AIProvider
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
    apiKey?: string
    projectId?: string | null
    chatId?: string | null
    /** Canonical tool ids the user has armed in the slash menu, e.g.
     *  ["web_search", "run_javascript"]. Anything else is ignored — the
     *  client is untrusted, so we only accept ids we know how to map. */
    tools?: string[]
  } = requestData

  // Project budget gate — block before spending if the project is out of credit.
  if (projectId) {
    const caller = await getCallerForLogging()
    if (caller) {
      try {
        await assertBudget({ projectId, userId: caller.userId })
      } catch (e) {
        const err = e as Error & { status?: number }
        return Response.json({ error: err.message }, { status: err.status ?? 402 })
      }
    }
  }

  console.log('[v0] /api/chat:', {
    provider,
    model,
    hasClientKey: Boolean(apiKey),
    messagesCount: Array.isArray(messages) ? messages.length : 0,
  })

  try {
    // We always call providers directly via their @ai-sdk/* package
    // (LanguageModelV1). The AI Gateway path was removed because ai@4
    // does not accept gateway model strings — it would 400 on every request
    // with "Unsupported model version. AI SDK 4 only supports models that
    // implement specification version 'v1'."
    const resolved = resolveLanguageModel(provider, model, apiKey)
    console.log('[v0] resolved model via provider SDK')

    // Inflate `experimental_attachments` from useChat into multimodal content
    // parts. Vision-capable models (gpt-4o, claude 3.x, gemini 2.5, etc.) read
    // image parts natively; text-only models will simply ignore them. PDFs and
    // other non-image types are referenced by name so the model knows they
    // exist even if it cannot decode them.
    // Run the inflate step in parallel — each message's binary
    // attachments may need a 100-300ms extraction pass, and a typical
    // chat with one or two prior turns gets to the model noticeably
    // faster when we let them run concurrently rather than serially.
    const inflatedMessages = await Promise.all(
      (Array.isArray(messages) ? messages : []).map(inflateAttachments),
    )

    // ── Auto-compaction (Phase 3) ───────────────�����─────────────────
    //
    // Long chats accumulate token cost linearly. By the time a chat
    // hits 20-30 turns, the message array alone can exceed 8k tokens
    // — and combined with the (cached) system prefix that pushes
    // every request past Opus 4.6's 10k TPM ceiling. The compactor
    // is a pure heuristic that folds older turns into a single
    // summary system message while keeping the most recent ~8 turns
    // verbatim, so the model retains coherence on the recent
    // exchange while we shed bulk on the historical prefix.
    //
    // Per-model budget. The cap below is for the MESSAGES payload
    // alone — we leave the rest of the TPM ceiling to the system
    // prompt (which is mostly cacheable) and the model's completion.
    const compactionBudget = (() => {
      const id = (model ?? '').toLowerCase()
      // Opus 4.6 is the tightest at 10k TPM tier-1. We aim for ~5k
      // messages so even a worst-case dynamicSystem (3k) + completion
      // (2k) headroom keeps us under cap.
      if (id.includes('opus'))   return 5000
      // Sonnet has 80k TPM headroom — barely worth compacting at all,
      // but a soft cap keeps requests fast.
      if (id.includes('sonnet')) return 20000
      if (id.includes('haiku'))  return 30000
      // OpenAI gpt-5/4: 30k TPM tier-1.
      if (id.includes('gpt'))    return 18000
      if (id.includes('o1') || id.includes('o3')) return 18000
      // Gemini: 1M+ TPM, basically uncapped — only fire compaction
      // on truly enormous transcripts.
      if (id.includes('gemini')) return 80000
      // Conservative default for any unknown / future model.
      return 10000
    })()
    const compaction = compactTranscript(inflatedMessages, {
      maxBudgetTokens: compactionBudget,
    })
    if (compaction.compactedCount > 0) {
      console.log(
        `[v0] auto-compacted ${compaction.compactedCount} turns ` +
        `(${compaction.beforeTokens} → ${compaction.afterTokens} tok) ` +
        `for model=${model}`,
      )
    }
    const messagesForModel = compaction.messages

    const caller = await getCallerForLogging()

    // ── System-prompt segmentation for prompt caching ──────────────
    //
    // We split the system prompt into TWO segments so providers can
    // cache the stable part:
    //
    //   stableSystem  — the Clox capabilities preamble. ~3.5k tokens,
    //                   identical on every request, the single biggest
    //                   recurring cost in our input bill.
    //   dynamicSystem — the user-saved system prompt + any auto-detect
    //                   skill blocks attached for THIS turn. Varies
    //                   per chat (and per turn when auto-detect fires)
    //                   so it must not be marked as part of the cache
    //                   prefix.
    //
    // Caching by provider:
    //
    //   Anthropic — explicit. We mark the stableSystem message with
    //     `experimental_providerMetadata.anthropic.cacheControl =
    //     { type: 'ephemeral' }`. Anthropic caches up to and
    //     including that breakpoint with a 5-minute TTL; subsequent
    //     turns within that window pay 10% of the input token cost
    //     AND count as 10% of the per-minute rate-limit accounting.
    //     Cuts the typical 8-10k input request to ~1-2k after the
    //     first turn, which is the difference between bouncing off
    //     Opus 4.6's 10k TPM ceiling and not.
    //
    //   OpenAI — automatic. Any prompt ≥1024 tokens is auto-cached
    //     keyed on its prefix; a 50% discount kicks in on prefix
    //     hits. No markers needed — we just have to keep the
    //     prefix stable, which is exactly why we've split here.
    //     Caches are best-effort: cleared after ~5-10 minutes of
    //     inactivity, but during an active chat they hit reliably.
    //
    //   Google Gemini — implicit on 2.5 family. Cached prefix tokens
    //     get a 75% discount automatically. Same prefix-stability
    //     requirement; no markers.
    //
    // We always emit `stableSystem` first and `dynamicSystem` second,
    // both as separate system messages. AI SDK v4's provider adapters
    // concatenate consecutive system messages for providers that don't
    // accept multiple (OpenAI, Gemini), so this works universally.
    // Load the skill catalogue once (cached for 60s in module scope).
    // The slim INDEX (id + name + one-line description for every skill)
    // gets folded into the cacheable stableSystem so the model knows
    // what's loadable; the catalog Map is closed over by the
    // `read_skill` tool factory below for O(1) full-prompt lookup.
    const skillCatalog = await loadSkillCatalog()
    const skillIndex = buildSkillIndex(skillCatalog)

    const stableSystem = skillIndex
      ? `${CLOX_CAPABILITIES_PREAMBLE}\n${skillIndex}`
      : CLOX_CAPABILITIES_PREAMBLE
    const dynamicSystem = systemPrompt ?? ''
    const isAnthropic = provider === 'anthropic'
    // Kept for backwards compat with the few places below that still
    // reference the old name (sandbox auto-arming, telemetry).
    const composedSystem = dynamicSystem
      ? `${stableSystem}\n\n---\n\n${dynamicSystem}`
      : stableSystem

    // Build the tools bag for THIS request based on what the user has
    // armed in the slash menu. We allow-list known ids — a malicious
    // body claiming `tools: ['delete_database']` simply gets ignored
    // because the id has no entry in this map. Sandbox tools are
    // factories because they need to bind the chatId to find the
    // right per-conversation microVM.
    const enabledTools: Record<string, unknown> = {}

    // ─── Sandbox auto-arming ─────────────────────────────────────────
    // The 6 file-handling skills (PDF/DOCX/XLSX/PPTX read+write, File
    // Reading, PDF Deep Reading) tell the model to call `python` and
    // `bash` against `/mnt/user-data/uploads/` and `/mnt/user-data/
    // outputs/`. Before this auto-arm, those skills only worked when
    // the user ALSO toggled "python sandbox" in the composer — a UX
    // trap that produced "blank PPT" results when a skill was active
    // but the toggle was off.
    //
    // We check TWO surfaces for the canonical sandbox mount path:
    //
    //   1. `composedSystem` — the assembled stable+dynamic prompt
    //      shipped to the model on turn 1. Catches manually-pasted
    //      skill content and `dynamicSystem` overrides.
    //
    //   2. ANY skill body in the catalogue. Skills are loaded LAZILY
    //      via the `read_skill` tool — their full text never lands
    //      in `composedSystem` until the model has already started
    //      streaming. So checking composedSystem alone misses the
    //      common case: user asks "make me an XLSX", model calls
    //      `read_skill({xlsx})`, primer says "use python + write to
    //      /mnt/user-data/outputs/" — but python isn't attached
    //      because we never armed it. Model then dumps Python source
    //      as assistant text, hits the 2048-token default cap, and
    //      truncates at ~140 lines (the visible "XLSX cut off mid-
    //      generation" bug). Inspecting the full catalogue at request-
    //      build time avoids that race entirely.
    //
    // The detection is intentionally narrow — matching the literal
    // `/mnt/user-data/` so it can't mis-fire on unrelated text.
    //
    // To avoid arming the sandbox on EVERY chat (which would happen
    // if we just looked at the catalogue, since document skills are
    // globally available), we additionally gate on user intent: the
    // most recent user message text must look like a document task,
    // OR the user must have attached a file. The keyword list is
    // deliberately broad enough to catch natural phrasings ("excel",
    // "spreadsheet", "deck", "pdf", "word doc") without going so
    // wide that it false-positives on unrelated chats.
    const messageList: IncomingMessage[] = Array.isArray(messages)
      ? (messages as IncomingMessage[])
      : []
    const lastUserMessage = (() => {
      for (let i = messageList.length - 1; i >= 0; i--) {
        const m = messageList[i]
        if (m?.role === 'user') {
          if (typeof m.content === 'string') return m.content
          if (Array.isArray(m.content)) {
            return (m.content as Array<{ type?: string; text?: string }>)
              .map(p =>
                p?.type === 'text' && typeof p.text === 'string' ? p.text : ''
              )
              .join(' ')
          }
        }
      }
      return ''
    })().toLowerCase()
    const DOC_KEYWORDS_RE =
      /\b(xlsx|excel|spreadsheet|pivot table|workbook|pptx|powerpoint|slides?|deck|presentation|pdf|docx|word doc|word document|csv|chart|graph)\b/i
    const userHasFileAttachment = (() => {
      for (const m of messageList) {
        if (m?.role === 'user' && Array.isArray(m.content)) {
          for (const part of m.content as Array<{ type?: string }>) {
            if (part?.type === 'file' || part?.type === 'image') return true
          }
        }
      }
      return false
    })()
    const userIntentNeedsDocs =
      DOC_KEYWORDS_RE.test(lastUserMessage) || userHasFileAttachment
    const catalogNeedsSandbox = userIntentNeedsDocs && (() => {
      for (const skill of Array.from(skillCatalog.values())) {
        if (skill.system_prompt.includes('/mnt/user-data/')) return true
      }
      return false
    })()
    const skillsRequireSandbox =
      composedSystem.includes('/mnt/user-data/') || catalogNeedsSandbox
    const userArmedSandbox =
      Array.isArray(requestedTools) &&
      (requestedTools.includes('bash') || requestedTools.includes('python'))
    const sandboxArmed = Boolean(chatId) && (userArmedSandbox || skillsRequireSandbox)

    if (Array.isArray(requestedTools)) {
      if (requestedTools.includes('web_search'))     enabledTools.web_search     = webSearchTool
      if (requestedTools.includes('run_javascript')) enabledTools.run_javascript = runJavaScriptTool
    }

    // `read_skill` is ALWAYS available (no opt-in) when the catalogue
    // is non-empty. It pairs with the slim "Available skills" index
    // we spliced into stableSystem above — that index tells the model
    // what's loadable, this tool actually loads it. The cost of having
    // it permanently armed is small (~150 tokens of tool description)
    // and the benefit is large (the model can pull in any specialist
    // on demand instead of us pre-loading every plausible match).
    if (skillCatalog.size > 0) {
      enabledTools.read_skill = makeReadSkillTool(skillCatalog)
    }
    // Sandbox tools (bash + python) are bound INSIDE
    // `createDataStreamResponse.execute` further down. They need a
    // reference to `dataStream.writeMessageAnnotation` so they can
    // emit live progress events ("Starting Python sandbox", "Running
    // python: from pptx import …") into the assistant message. Same
    // reason `prewarmSandbox` moved into `execute`.

    // If the user armed the sandbox tools and attached files, mount the
    // raw bytes into the per-chat sandbox so Python can open them at
    // `/mnt/user-data/uploads/<name>`. We do this BEFORE streaming
    // starts so the model can call `python` immediately on its first
    // turn without a round-trip waiting for the upload to land.
    // The existing `inflateAttachments` path still inlines extracted
    // text into the prompt — the sandbox mount is additive, not a
    // replacement, so vision and inline-text behaviours are unchanged.
    if (sandboxArmed && chatId) {
      try {
        const buffers = extractAttachmentBuffers(Array.isArray(messages) ? messages : [])
        if (buffers.length > 0) await mountAttachments(chatId, buffers)
      } catch (e) {
        // Mounting failure is non-fatal — the model will still try, get
        // an empty uploads dir, and tell the user. We log so an
        // operator notices repeated failures.
        console.error('[v0] sandbox mount failed:', (e as Error).message)
      }
    }

    // We use `createDataStreamResponse` (not the simpler
    // `result.toDataStreamResponse`) because it gives us a `dataStream`
    // handle we can write per-message annotations to from inside
    // `onFinish`. The annotations carry the list of files the sandbox
    // produced, so `<DownloadStrip>` can render chips below the
    // assistant's reply.
    return createDataStreamResponse({
      // Mirror the previous error-forwarding behaviour. By default the
      // SDK masks every server-side error with "An error occurred."
      // and the user-facing `onError` handler in useChat gets no
      // context. We surface the real cause so debugging works.
      onError: (error: unknown) => {
        if (error == null) return 'Unknown chat error'
        if (typeof error === 'string') return error
        if (error instanceof Error) return error.message
        try { return JSON.stringify(error) } catch { return String(error) }
      },
      execute: dataStream => {
        // Tell the UI we auto-compacted older turns. Surfaced as a
        // small badge above the assistant's response so the user
        // knows context was condensed and can hit "Compact chat
        // again" if they want a fresh summary or restore old turns.
        if (compaction.compactedCount > 0) {
          try {
            dataStream.writeMessageAnnotation({
              type: 'compaction',
              compactedCount: compaction.compactedCount,
              beforeTokens:   compaction.beforeTokens,
              afterTokens:    compaction.afterTokens,
              ts: Date.now(),
            })
          } catch { /* annotation write is cosmetic */ }
        }
        // `writeProgress` bridges the per-call SandboxProgressCallback
        // signature into a message annotation on the in-flight
        // assistant turn. Annotations written here land on the message
        // useChat is currently appending — they're rendered as a tiny
        // status strip above the tool-invocation pills. We swallow
        // errors because the dataStream may have closed by the time a
        // late event fires (e.g. a still-installing pip after the
        // model already finished); progress is cosmetic and missing
        // events are never fatal.
        const writeProgress = (event: Record<string, unknown>) => {
          try {
            // Log every progress event server-side so we can verify
            // the pipeline by inspecting deployment logs. The user
            // reported the client never sees these — without server
            // logs we can't tell whether the events fire at all or
            // are firing fine and getting lost in transit. Cheap
            // tracing buys us that signal.
            console.log('[v0] sandbox progress:', JSON.stringify(event))
            dataStream.writeMessageAnnotation({
              type: 'sandbox-progress',
              ts:   Date.now(),
              ...event,
            })
          } catch (e) {
            // Stream closed (model finished before this background
            // event fired) — log so we know which events are getting
            // dropped, but never throw.
            console.warn(
              '[v0] sandbox progress dropped:',
              JSON.stringify(event),
              (e as Error).message,
            )
          }
        }
        // Bind sandbox tools NOW so they capture the live writeProgress
        // closure. We always bind BOTH bash + python when arming —
        // a model that has `python` but not `bash` can't `pip install`
        // a missing package, can't `ls` to see what was uploaded, and
        // can't `file` to disambiguate a binary upload. They're a pair.
        if (sandboxArmed && chatId) {
          enabledTools.bash   = makeBashTool(chatId, writeProgress)
          enabledTools.python = makePythonTool(chatId, writeProgress)
          // Pre-warm the sandbox immediately. Kicks off (a) microVM
          // cold-boot (~5-10s) and (b) pip-installing the canonical
          // Python deps (~30-40s on a fresh VM, instant under the
          // snapshot) in parallel with the model's first tokens
          // streaming back. The progress events generated by these
          // background phases reach the user via writeProgress, so
          // the chat shows "Starting Python sandbox…" → "Installing
          // python deps (~30-40s)" → "Sandbox ready" before the
          // first python call even fires.
          prewarmSandbox(chatId, writeProgress)
        }
        // Has-tools must be recomputed AFTER sandbox tool binding, not
        // at the top of the route, because we now bind bash + python
        // here. An empty `tools: {}` map upsets Anthropic with a 400
        // — the conditional spread below still depends on this flag.
        const hasTools = Object.keys(enabledTools).length > 0
        const result = streamText({
          // `resolved` is always a LanguageModelV1 instance now (gateway
          // strings were removed). The cast satisfies the streamText prop
          // type without pulling the full v1 union into this file.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: resolved as any,
          messages: [
            // Stable cacheable prefix. The Anthropic-only metadata is
            // ignored by every other provider's adapter, so emitting
            // it unconditionally is safe — but we ALSO key the
            // metadata's presence on the live provider so a future
            // adapter that complains about unknown keys doesn't break
            // OpenAI / Gemini chats.
            {
              role: 'system' as const,
              content: stableSystem,
              ...(isAnthropic ? {
                experimental_providerMetadata: {
                  anthropic: { cacheControl: { type: 'ephemeral' as const } },
                },
              } : {}),
            },
            // Dynamic per-turn segment. Skipped when empty so we don't
            // emit a useless second system message that some providers
            // (xai, perplexity) handle imperfectly.
            ...(dynamicSystem
              ? [{ role: 'system' as const, content: dynamicSystem }]
              : []),
            ...(messagesForModel as never[]),
          ],
          temperature,
          // Document-generation requests (sandbox armed) burn tokens
          // fast: per-slide content + multi-paragraph python snippets
          // + tool result reads. The 2048 default truncated a 5-slide
          // PPT mid-deck. We auto-promote to a high floor when the
          // sandbox is armed so multi-doc flows can complete in a
          // single turn without "reply continue" gymnastics.
          //
          // Floor sizing:
          //   - 64k covers ~80% of legitimate doc-build turns (a
          //     full 10-slide deck + python source + tool result
          //     echoes lands around 40-50k output tokens).
          //   - The cap still respects the per-model ceiling from
          //     ai-capabilities.ts, so requesting 64k on Gemini 2.5
          //     Flash (max 65k) is fine, on Sonnet 4.6 (max 128k
          //     via beta header below) it's well under the limit.
          //
          // Caller-supplied `maxTokens` still wins if it's higher
          // (user explicitly opted into a bigger budget — clamped
          // at the capability ceiling upstream). A non-sandbox text
          // chat keeps the requested cap as-is so we don't silently
          // inflate cost for plain conversations.
          maxTokens: sandboxArmed ? Math.max(maxTokens, 64_000) : maxTokens,
          // The AI SDK retries every failed request twice (3 attempts
          // total) with no special handling for 429s. That's actively
          // harmful against Anthropic's PER-MINUTE input-token cap:
          //
          //   t=0s   attempt 1 fails (over quota)
          //   t=2s   attempt 2 fails (still over quota)
          //   t=6s   attempt 3 fails (still over quota)
          //
          // Three blasts inside ~6 seconds doesn't give the rolling
          // window a chance to refill. Worse, EACH attempt counts
          // against the per-minute budget, so 3 attempts at 6k input
          // tokens = 18k of consumed quota for zero output — and the
          // user sees "Failed after 3 attempts" instead of the
          // original first-shot error. We do server-side fallback to
          // Haiku ourselves in onError (Phase 2), so this SDK-level
          // retry is pure pessimisation.
          maxRetries: 0,
          // NOTE on the 128k output beta: the `anthropic-beta:
          // output-128k-2025-02-19` header is now applied where it
          // belongs — at provider construction time in
          // model-router.ts (createAnthropic({ headers })). It was
          // previously set here on providerOptions.anthropic.headers,
          // which AI SDK v4 silently drops (that slot accepts model
          // options like cacheControl, not HTTP headers). That bug
          // is what kept Claude responses ending at 32k regardless
          // of what maxTokens we requested.
          // Only attach tools when at least one is armed. Passing an empty
          // map confuses some providers (Anthropic in particular emits a
          // 400 when `tools: {}` is sent), so we keep the request shape
          // identical to the pre-tools path when nothing is on.
          ...(hasTools
            ? {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                tools: enabledTools as any,
                // Cap the number of model<->tool round trips so a
                // runaway chain (model keeps calling its tools
                // forever) can't drain the user's budget.
                //
                // Sizing it: each tool round trip = 2 steps (call +
                // result). A realistic single-doc flow with one
                // debugging pass is `read_skill → cat SKILL.md →
                // python v1 (timeout) → python v2 → bash inspect →
                // python fix → answer` = 14 steps. A multi-doc
                // request (Excel + PPT + Docs) easily hits 40+:
                //
                //   Skill loads .................   6 steps (3 × 2)
                //   Per-doc build + inspect ......  18 steps (3 × 6)
                //   Per-doc fix-up ..............    6 steps (3 × 2)
                //   Final compile / list outputs .   4 steps
                //   Answer ......................    1 step
                //                                 = 35 steps
                //
                // The old cap of 20 was hitting mid-build and the
                // model would just terminate without an error — from
                // the user's view, "the script stopped". Bumping to
                // 50 leaves headroom for recovery loops while still
                // bounding worst-case cost (~$0.15 per turn on
                // Sonnet 4.6 at 50 steps assuming ~3k input tokens
                // average per step). Single-doc tasks finish well
                // under 20 steps so the bump only matters for the
                // genuinely complex flows where the old cap actively
                // hurt.
                maxSteps: sandboxArmed ? 50 : 4,
              }
            : {}),
          onFinish: async ({ usage, finishReason }) => {
            // (0) Finish-reason telemetry + user-facing nudge.
            //     `finishReason` tells us EXACTLY why the stream
            //     ended. Until now we logged nothing here, which is
            //     why "the script stopped" was such a mystery — the
            //     model could hit the output token cap, the step
            //     cap, or finish cleanly, and all three looked
            //     identical from the chat surface (a sudden end of
            //     stream with no explanation).
            //
            //     We log the reason server-side AND, for the two
            //     "ran out of budget" reasons, write a message
            //     annotation so the client can render a clear
            //     banner ("Output budget exhausted — ask the model
            //     to continue") instead of leaving the user
            //     staring at a truncated message.
            console.log(
              '[v0] streamText finished:',
              JSON.stringify({
                finishReason,
                promptTokens: usage?.promptTokens,
                completionTokens: usage?.completionTokens,
                sandboxArmed,
                chatId,
              }),
            )
            if (finishReason === 'length' || finishReason === 'other') {
              try {
                dataStream.writeMessageAnnotation({
                  type: 'finish-warning',
                  reason: finishReason,
                  // Human-readable, surface this verbatim in the UI.
                  message:
                    finishReason === 'length'
                      ? 'Reached the model\'s per-turn output limit. The work above is complete up to where the message ends — reply "continue" to resume.'
                      : 'Hit the tool-step cap (50 sequential tool calls). The deliverables produced so far were saved to your outputs and uploaded; reply "continue" to finish the rest.',
                })
              } catch {
                // Stream might already be closed; the server log
                // above is enough for debugging either way.
              }
            }

            // (1) Usage accounting — unchanged from the old route.
            if (caller) {
              try {
                await recordUsage({
                  userId: caller.userId,
                  domain: caller.domain,
                  provider: String(provider),
                  model,
                  modality: 'text',
                  chatType: 'text',
                  promptTokens: usage?.promptTokens,
                  completionTokens: usage?.completionTokens,
                  projectId: projectId ?? null,
                  chatId: chatId ?? null,
                })
              } catch (e) {
                console.error('[v0] usage log failed:', (e as Error).message)
              }
            }

            // (2) Sandbox-output collection. We diff the outputs dir
            // against everything we already know about for this chat
            // and surface only the NEW files. Each file is uploaded to
            // the per-user folder in the `chat-outputs` Supabase bucket
            // and a signed URL is written to the assistant message's
            // annotations array so the client can render a download
            // chip without polling.
            if (sandboxArmed && chatId && caller) {
              try {
                const outputs = await collectOutputs(chatId)
                for (const o of outputs) {
                  try {
                    const uploaded = await uploadChatOutput({
                      userId: caller.userId,
                      chatId,
                      filename: o.filename,
                      content: o.content,
                      contentType: o.mime,
                    })
                    dataStream.writeMessageAnnotation({
                      type: 'output-file',
                      filename: uploaded.filename,
                      url: uploaded.signedUrl,
                      mime: uploaded.mime,
                      size: uploaded.size,
                    })
                  } catch (e) {
                    console.error('[v0] chat-output upload failed:', (e as Error).message)
                  }
                }
              } catch (e) {
                console.error('[v0] sandbox collect failed:', (e as Error).message)
              }
            }
          },
        })

        // Pipe the model stream into the data stream the route owns.
        // `mergeIntoDataStream` forwards every text chunk, tool call,
        // and tool result; our annotations from `onFinish` arrive
        // alongside in the same data envelope.
        result.mergeIntoDataStream(dataStream)
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown chat error'
    console.error('[v0] /api/chat error:', message)
    // Return a structured error the client can show inline.
    return Response.json({ error: message }, { status: 400 })
  }
}
