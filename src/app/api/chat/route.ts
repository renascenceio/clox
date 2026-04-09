import { streamText } from 'ai'
import { getModel, AIProvider } from '@/domains/text-generation/services/model-router'
import { getAdminSettings } from '@/lib/admin-settings'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, model, provider, temperature = 0.7, maxTokens = 2048, systemPrompt } = await req.json()

  // Check admin settings
  const settings = getAdminSettings()
  const providerConfig = settings.providers[provider]
  
  // Default to enabled if not explicitly set
  const isEnabled = providerConfig?.enabled ?? true

  if (!isEnabled) {
    return new Response('This AI provider is disabled. Enable it in Admin Settings.', { status: 403 })
  }

  // Note: API key check removed - we'll let the provider handle missing keys with proper error messages

  console.log('[v0] Using provider:', provider, 'with model:', model)
  console.log('[v0] Provider config:', { enabled: isEnabled, hasKey: !!providerConfig?.apiKey })

  // Set API key as environment variable so the model can use it
  if (providerConfig?.apiKey) {
    const envKey = `${provider.toUpperCase()}_API_KEY`
    process.env[envKey] = providerConfig.apiKey
    console.log('[v0] Set environment variable:', envKey)
  }

  try {
    const result = await streamText({
      model: getModel(provider as AIProvider, model),
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
