import { streamText } from 'ai'
import { getModel, AIProvider } from '@/domains/text-generation/services/model-router'

export const maxDuration = 30

export async function POST(req: Request) {
  let requestData
  
  try {
    requestData = await req.json()
  } catch (e) {
    console.error('[v0] Failed to parse request body:', e)
    return new Response('Invalid request body', { status: 400 })
  }
  
  const { messages, model, provider, temperature = 0.7, maxTokens = 2048, systemPrompt, apiKey } = requestData

  console.log('[v0] Chat API called:', { 
    provider, 
    model, 
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    messagesCount: messages?.length || 0
  })

  if (!apiKey) {
    console.error('[v0] No API key provided for provider:', provider)
    return new Response(`No API key configured for ${provider}. Please add your API key in Admin > API Keys.`, { status: 400 })
  }

  try {
    // Get the LanguageModel instance for this provider with the API key from admin settings
    console.log('[v0] Getting model for provider:', provider, 'model:', model)
    const languageModel = getModel(provider as AIProvider, model, apiKey)
    console.log('[v0] Got language model, starting streamText')

    const result = await streamText({
      model: languageModel,
      messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages,
      temperature,
      maxTokens,
    })

    console.log('[v0] streamText completed, returning response')
    return result.toDataStreamResponse()
  } catch (error) {
    console.error('[v0] Error in chat API:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('[v0] Error details:', { errorMessage, errorStack })
    return new Response(`Error: ${errorMessage}`, { status: 500 })
  }
}
