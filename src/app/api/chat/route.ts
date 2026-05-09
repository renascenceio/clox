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
    } else {
      // Reference non-image attachments inline so the model knows they exist
      // even when it cannot decode the bytes itself.
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
    // Pick the best way to actually run this model: client key > env var > AI Gateway.
    const resolved = resolveLanguageModel(provider, model, apiKey)
    console.log(
      '[v0] resolved model via:',
      typeof resolved === 'string' ? `gateway (${resolved})` : 'provider SDK',
    )

    // Inflate `experimental_attachments` from useChat into multimodal content
    // parts. Vision-capable models (gpt-4o, claude 3.x, gemini 2.5, etc.) read
    // image parts natively; text-only models will simply ignore them. PDFs and
    // other non-image types are referenced by name so the model knows they
    // exist even if it cannot decode them.
    const inflatedMessages = (Array.isArray(messages) ? messages : []).map(inflateAttachments)

    const caller = await getCallerForLogging()

    const result = streamText({
      // The AI SDK 4 `model` field accepts either a LanguageModelV1 instance or
      // a gateway model-id string like `openai/gpt-4o`.
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

    return result.toDataStreamResponse()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown chat error'
    console.error('[v0] /api/chat error:', message)
    // Return a structured error the client can show inline.
    return Response.json({ error: message }, { status: 400 })
  }
}
