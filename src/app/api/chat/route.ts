import { streamText } from 'ai'
import { getModel, AIProvider } from '@/domains/text-generation/services/model-router'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, model, provider, temperature = 0.7, maxTokens = 2048, systemPrompt } = await req.json()

  console.log('[v0] Chat API called:', { provider, model })

  try {
    // Get the LanguageModel instance for this provider
    const languageModel = getModel(provider as AIProvider, model)

    const result = await streamText({
      model: languageModel,
      messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages,
      temperature,
      maxTokens,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('[v0] Error in chat API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`Error: ${errorMessage}`, { status: 500 })
  }
}
