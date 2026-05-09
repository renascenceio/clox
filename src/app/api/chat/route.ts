import { streamText } from 'ai'
import { resolveLanguageModel, AIProvider } from '@/domains/text-generation/services/model-router'
import { assertBudget } from '@/lib/projects/server'
import { recordUsage, getCallerForLogging } from '@/lib/projects/usage'

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
 *  multimodal `content: ContentPart[]` shape that streamText expects. */
function inflateAttachments(raw: unknown): unknown {
  const m = raw as IncomingMessage
  const atts = m.experimental_attachments
  if (!Array.isArray(atts) || atts.length === 0) return m

  const text = typeof m.content === 'string' ? m.content : ''
  const parts: Array<Record<string, unknown>> = []

  if (text.trim().length > 0) parts.push({ type: 'text', text })

  for (const att of atts) {
    if (!att?.url) continue
    const ct = att.contentType ?? ''
    if (ct.startsWith('image/')) {
      // streamText accepts both data URLs and remote URLs in the `image` field.
      parts.push({ type: 'image', image: att.url })
    } else if (isInlineableTextType(ct)) {
      // Inline the decoded text so the model can actually read CSVs,
      // JSON files, source code, markdown notes, etc. Wrap each one in
      // a fenced block tagged with the filename + content-type so the
      // model can refer to it by name in its answer.
      const decoded = decodeDataUrlAsText(att.url)
      if (decoded == null) {
        parts.push({
          type: 'text',
          text: `[Attachment: ${att.name ?? 'file'} (${ct}) — could not decode]`,
        })
        continue
      }
      const name = att.name ?? 'file'
      parts.push({
        type: 'text',
        text: [
          `Attached file: ${name} (${ct})`,
          '```',
          decoded,
          '```',
        ].join('\n'),
      })
    } else {
      // Binary / unknown — reference it by name only.
      parts.push({
        type: 'text',
        text: `[Attachment: ${att.name ?? 'file'} (${ct || 'application/octet-stream'})]`,
      })
    }
  }

  // If we ended up with only one text part, return it as a string for
  // maximum compatibility with text-only models.
  if (parts.length === 1 && parts[0].type === 'text') {
    return { ...m, content: (parts[0] as { text: string }).text }
  }

  return { ...m, content: parts }
}

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
    const inflatedMessages = (Array.isArray(messages) ? messages : []).map(inflateAttachments)

    const caller = await getCallerForLogging()

    const result = streamText({
      // `resolved` is always a LanguageModelV1 instance now (gateway strings
      // were removed). The cast satisfies the streamText prop type without
      // pulling the full v1 union into this file.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: resolved as any,
      messages: systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...(inflatedMessages as never[])]
        : (inflatedMessages as never[]),
      temperature,
      maxTokens,
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
