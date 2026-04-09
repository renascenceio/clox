import { streamText } from 'ai'
import { getModel, AIProvider } from '@/domains/text-generation/services/model-router'
import { getAdminSettings } from '@/lib/admin-settings'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, model, provider, temperature = 0.7, maxTokens = 2048, systemPrompt } = await req.json()

  // Check admin settings
  const settings = getAdminSettings()
  const providerConfig = settings.providers[provider]

  if (!providerConfig?.enabled) {
    return new Response('This AI provider is disabled. Enable it in Admin Settings.', { status: 403 })
  }

  if (!providerConfig?.apiKey) {
    return new Response('API key not configured for this provider. Add it in Admin Settings.', { status: 400 })
  }

  console.log('[v0] Using provider:', provider, 'with model:', model)

  const result = await streamText({
    model: getModel(provider as AIProvider, model),
    messages: systemPrompt ? [{ role: 'system', content: systemPrompt }, ...messages] : messages,
    temperature,
    maxTokens,
  })

  return result.toDataStreamResponse()
}
