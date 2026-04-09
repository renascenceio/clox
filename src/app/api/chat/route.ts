import { streamText } from 'ai'
import { getGatewayModelString, AIProvider } from '@/domains/text-generation/services/model-router'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, model, provider, temperature = 0.7, maxTokens = 2048, systemPrompt } = await req.json()

  console.log('[v0] Chat API called with provider:', provider, 'model:', model)

  // Get the AI Gateway model string (e.g., 'google/gemini-2.0-flash-001')
  const gatewayModel = getGatewayModelString(provider as AIProvider, model)
  console.log('[v0] Using AI Gateway model:', gatewayModel)

  try {
    const result = await streamText({
      model: gatewayModel, // AI Gateway handles auth automatically
      messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages,
      temperature,
      maxTokens,
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('[v0] Error in chat API:', error)
    return new Response(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 })
  }
}
