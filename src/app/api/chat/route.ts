import { streamText, createDataStreamResponse } from 'ai'
import { resolveLanguageModel, AIProvider } from '@/domains/text-generation/services/model-router'
import { assertBudget } from '@/lib/projects/server'
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
const CLOX_CAPABILITIES_PREAMBLE = [
  'You are running inside Clox, a full-capability AI workspace. The chat',
  'surface renders every fenced code block in your reply as a downloadable,',
  'previewable artifact with Copy / Download / Preview controls — and for',
  'document-style blocks, real binary export to Microsoft Office and PDF.',
  'You can therefore "produce files" with the same fluency as ChatGPT,',
  'Claude, or Gemini in their native UIs.',
  '',
  'NEVER tell the user you "can\'t generate Excel/Word/PowerPoint/PDF",',
  '"only output text", or "can\'t create files". You CAN. Pick the right',
  'fenced language tag below and the workspace handles the binary build.',
  '',
  'STRICT format-to-fence mapping. The fence tag MUST mirror what the',
  'user asked for so the artifact toolbar reads the same as their',
  'request. The toolbar promotes the matching export to a primary',
  '"download <format>" button — getting the tag wrong forces the user',
  'to hunt for the right download and makes the reply feel like the',
  'wrong artifact came back.',
  '',
  '  User asked for…       →  fence tag       Body shape',
  '  ────────────────────     ─────────────   ──────────────────────────',
  '  HTML page / web demo  →  ```html         full HTML document or fragment',
  '  PDF                   →  ```pdf          markdown OR html (rendered → PDF)',
  '  Word document / .docx →  ```docx         markdown body',
  '  Slide deck / .pptx    →  ```pptx         JSON outline (see below)',
  '  Excel / spreadsheet   →  ```csv          one block per sheet, each',
  '                                           preceded by a',
  '                                           "### Sheet: <name>" heading',
  '  CSV (single, raw)     →  ```csv          single block, no heading',
  '  Plain markdown / .md  →  ```markdown     markdown',
  '  SVG diagram           →  ```svg          raw <svg>…</svg>',
  '  JSON data             →  ```json         pretty JSON',
  '  Chart / visualisation →  ```html         with inline <script> (Chart.js,',
  '                                           D3, or hand-rolled SVG)',
  '  Diagram / flowchart   →  ```svg          (or ```html with mermaid)',
  '  Source code           →  ```<language>   the code',
  '',
  // pptx, pdf, docx, xlsx specifics (schema, colour palettes, Path-A
  // vs Path-B selection, incremental build pattern) live in the
  // matching document-craft skills (PowerPoint Slide Specialist, PDF
  // Document Specialist, Word Document Specialist, Excel Spreadsheet
  // Specialist) which auto-activate on intent. The python tool also
  // documents `/mnt/skills/`, `/mnt/user-data/outputs/`, and the
  // 180s incremental pattern in its own description. Repeating any
  // of that here just inflates every request by ~1.5k tokens — Opus
  // 4.6 hits its 10k input-TPM ceiling on a fresh chat with a
  // one-line prompt because of these duplicate paragraphs. Keep it
  // brief; the skill / tool description is authoritative.
  'Pptx outline shape (the body of a ```pptx block):',
  '  { "title": "…", "theme": { "background": "#…", "heading": "#…",',
  '    "body": "#…", "accent": "#…" }, "slides": [ { … } ] }',
  'When the active skill set includes a document specialist (pptx /',
  'pdf / docx / xlsx), follow ITS guidance for full schema, colour',
  'palettes, and python-vs-fenced-block path selection. Only fall',
  'back to building richer files via the python tool when its',
  'description tells you to.',
  '',
  'Multiple deliverables in one turn: when the user asks for SEVERAL',
  'formats at once (e.g. "give me a PDF and a docx of the same report"),',
  'emit ONE fenced block per deliverable, each tagged with its matching',
  'format. Do NOT pick one block tag and rely on the user clicking a',
  'secondary button — they expect each requested format to appear as',
  'its own labelled artifact card.',
  '',
  'Examples of correct routing:',
  '  • "Make me a chart of … as HTML"     → ```html  (with inline JS)',
  '  • "Generate a PDF report on …"       → ```pdf   (markdown body)',
  '  • "Write a Word doc summarising …"   → ```docx  (markdown body)',
  '  • "Build a 5-slide deck about …"     → ```pptx  (JSON outline)',
  '  • "Excel sheet of monthly figures"   → ```csv   (with sheet heading)',
  '  • "Give me both a PDF and a DOCX"    → ```pdf   THEN ```docx',
  '                                          (two separate blocks)',
  '',
  'When the user uploads a file, its contents are inlined earlier in the',
  'conversation under "Attached file: …". Clox already extracts text from:',
  '  • plain text, source code, JSON, YAML, CSV, markdown',
  '  • Word .docx (full body text)',
  '  • Excel .xlsx / .xls / .ods (one CSV block per sheet)',
  '  • PDF (page-by-page text extraction)',
  'Read these inline, analyse them, and respond with concrete answers —',
  'including emitting analysis scripts (Python pandas / JavaScript / SQL)',
  'as artifacts the user can download and run locally on their machine.',
  '',
  'Reply structure when you produce an artifact:',
  '  1. ONE short sentence framing what you\'re about to deliver',
  '     (e.g. "Here\'s the spreadsheet covering Q1–Q3 with totals.").',
  '  2. The fenced artifact block(s).',
  '  3. ONE short summary line afterwards stating what\'s inside, what',
  '     assumptions you made, and how to use it (e.g. "Click \'excel\' on',
  '     the toolbar to download as .xlsx — totals are in the bottom row.").',
  '  Do NOT end your reply with the closing fence and nothing else; the',
  '  user expects acknowledgement that the task finished. The intro and',
  '  closing are both required, even when the artifact is short.',
  '',
  'Other defaults:',
  '  • Always produce the artifact the user asked for. Don\'t describe',
  '    how they could build it themselves unless they ask.',
  '  • Prefer real, populated content over placeholder TODOs. If you are',
  '    inferring values from context, say so briefly and proceed.',
  '  • For long-form documents, structure with headings and lists so the',
  '    .docx / .pdf export looks professional out of the box.',
  '  • When emitting HTML for preview/download, ALWAYS use a fenced',
  '    ```html block. Never inline raw HTML in your prose — markdown',
  '    will not render it and the preview iframe will not see it.',
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

    const caller = await getCallerForLogging()

    // Always lead with the Clox capabilities preamble; the user's
    // own system prompt (if any) goes after it under the same role
    // so model-specific instruction-following treats them as one
    // continuous block. Concatenating into a single system message
    // is more reliable than two consecutive system entries — some
    // providers collapse / reject duplicates.
    const composedSystem = systemPrompt
      ? `${CLOX_CAPABILITIES_PREAMBLE}\n\n---\n\n${systemPrompt}`
      : CLOX_CAPABILITIES_PREAMBLE

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
    // but the toggle was off. We now detect the canonical sandbox
    // mount path in the composed system prompt and unconditionally
    // attach the tools when (a) chatId exists (per-chat microVM
    // routing requirement) and (b) the prompt clearly expects them.
    // The detection is intentionally narrow — matching the literal
    // `/mnt/user-data/` so it can't mis-fire on unrelated text. */
    const skillsRequireSandbox = composedSystem.includes('/mnt/user-data/')
    const userArmedSandbox =
      Array.isArray(requestedTools) &&
      (requestedTools.includes('bash') || requestedTools.includes('python'))
    const sandboxArmed = Boolean(chatId) && (userArmedSandbox || skillsRequireSandbox)

    if (Array.isArray(requestedTools)) {
      if (requestedTools.includes('web_search'))     enabledTools.web_search     = webSearchTool
      if (requestedTools.includes('run_javascript')) enabledTools.run_javascript = runJavaScriptTool
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
            { role: 'system', content: composedSystem },
            ...(inflatedMessages as never[]),
          ],
          temperature,
          // Document-generation requests (sandbox armed) burn tokens
          // fast: per-slide content + multi-paragraph python snippets
          // + tool result reads. The 2048 default truncated a 5-slide
          // PPT mid-deck. We auto-promote to a much higher ceiling
          // when the sandbox is armed — caller-supplied `maxTokens`
          // still wins if it's higher (the user explicitly opted in
          // to a bigger budget). A non-sandbox text chat keeps the
          // requested cap as-is so we don't silently inflate cost
          // for plain conversations.
          maxTokens: sandboxArmed ? Math.max(maxTokens, 16384) : maxTokens,
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
                // forever) can't drain the user's budget. The happy
                // path for docs is `bash ls → python v1 → bash list
                // outputs → answer` (4 steps), but a realistic flow
                // includes debugging: `bash ls → python v1
                // (ModuleNotFoundError) → bash pip install → python
                // v2 → bash inspect → python fix layout → bash list
                // outputs → answer` (8 steps), and a multi-doc
                // request can easily double that. 20 leaves headroom
                // for retries while still bounding worst-case cost.
                maxSteps: sandboxArmed ? 20 : 4,
              }
            : {}),
          onFinish: async ({ usage }) => {
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
