import { streamText } from 'ai'
import { resolveLanguageModel, AIProvider } from '@/domains/text-generation/services/model-router'

export const maxDuration = 60

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
  }: {
    messages: unknown[]
    model: string
    provider: AIProvider
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
    apiKey?: string
  } = requestData

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

    const result = streamText({
      // The AI SDK 4 `model` field accepts either a LanguageModelV1 instance or
      // a gateway model-id string like `openai/gpt-4o`.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: resolved as any,
      messages: systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...(messages as never[])]
        : (messages as never[]),
      temperature,
      maxTokens,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown chat error'
    console.error('[v0] /api/chat error:', message)
    // Return a structured error the client can show inline.
    return Response.json({ error: message }, { status: 400 })
  }
}
