import { streamText } from 'ai'
import { resolveLanguageModel, AIProvider } from '@/domains/text-generation/services/model-router'
import { assertBudget } from '@/lib/projects/server'
import { recordUsage, getCallerForLogging } from '@/lib/projects/usage'
import { webSearchTool } from '@/lib/tools/web-search'
import { runJavaScriptTool } from '@/lib/tools/run-javascript'

export const maxDuration = 60

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
  'Pptx outline shape (the body of a ```pptx block):',
  '  { "title": "Deck title (optional, becomes title slide)",',
  '    "slides": [',
  '      { "title": "Slide 1", "bullets": ["…","…"], "notes": "…" },',
  '      { "title": "Slide 2", "body": "free-form paragraph" }',
  '    ] }',
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
    // because the id has no entry in this map.
    const enabledTools: Record<string, unknown> = {}
    if (Array.isArray(requestedTools)) {
      if (requestedTools.includes('web_search'))     enabledTools.web_search     = webSearchTool
      if (requestedTools.includes('run_javascript')) enabledTools.run_javascript = runJavaScriptTool
    }
    const hasTools = Object.keys(enabledTools).length > 0

    const result = streamText({
      // `resolved` is always a LanguageModelV1 instance now (gateway strings
      // were removed). The cast satisfies the streamText prop type without
      // pulling the full v1 union into this file.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: resolved as any,
      messages: [
        { role: 'system', content: composedSystem },
        ...(inflatedMessages as never[]),
      ],
      temperature,
      maxTokens,
      // Only attach tools when at least one is armed. Passing an empty
      // map confuses some providers (Anthropic in particular emits a
      // 400 when `tools: {}` is sent), so we keep the request shape
      // identical to the pre-tools path when nothing is on.
      ...(hasTools
        ? {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tools: enabledTools as any,
            // Cap the number of model<->tool round trips so a runaway
            // chain (model keeps calling search forever) can't drain
            // the user's budget. 4 is plenty for "search → reason →
            // execute → answer" workflows.
            maxSteps: 4,
          }
        : {}),
      onFinish: async ({ usage }) => {
        if (!caller) return
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
      },
    })

    return result.toDataStreamResponse({
      // By default `toDataStreamResponse` masks every server-side error with
      // the literal string "An error occurred." which then fires through the
      // `useChat` `onError` handler with no context. That's why historical
      // failures (model 404s, missing keys, Anthropic auth) all surfaced in
      // the browser as the same useless message. We forward the real cause
      // so debugging — both ours and the user's — actually works.
      getErrorMessage: (error: unknown) => {
        if (error == null) return 'Unknown chat error'
        if (typeof error === 'string') return error
        if (error instanceof Error) return error.message
        try {
          return JSON.stringify(error)
        } catch {
          return String(error)
        }
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown chat error'
    console.error('[v0] /api/chat error:', message)
    // Return a structured error the client can show inline.
    return Response.json({ error: message }, { status: 400 })
  }
}
