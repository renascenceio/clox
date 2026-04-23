import { PROVIDERS } from '@/lib/providers'

/**
 * Returns which providers are actually usable on the server.
 *
 * Three sources of "connected" state, in priority order:
 *   1. A matching environment variable is set in Vercel (real production key).
 *   2. The provider is reachable via the connected Vercel AI Gateway with
 *      zero-config (openai, anthropic, google are supported by AI Gateway).
 *   3. The user typed a key into Super Admin -> API Keys (handled client-side
 *      against localStorage; this endpoint only knows about env + gateway).
 *
 * The admin UI and the dropdown filter merge this response with local keys to
 * decide whether a model is shown / marked "Connected".
 */

// AI Gateway bridges these providers with no additional per-provider key. We
// still list OpenAI's env var separately because users may want their own key
// for higher rate limits, but AI_GATEWAY_API_KEY alone is enough for these.
const AI_GATEWAY_ZERO_CONFIG = new Set(['openai', 'anthropic', 'google'])

export async function GET() {
  const aiGatewayConnected = Boolean(
    // When running on Vercel with the AI Gateway integration enabled, no key
    // is required — the runtime auto-authenticates. If an explicit key is set
    // (e.g. running locally or BYOK), we honour it.
    process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL,
  )

  const statuses: Record<
    string,
    { hasEnvKey: boolean; aiGatewayCapable: boolean; envKeyName: string }
  > = {}

  for (const provider of PROVIDERS) {
    const envValue = process.env[provider.envKey]
    const hasEnvKey = Boolean(envValue && envValue.trim().length > 0)
    const aiGatewayCapable = aiGatewayConnected && AI_GATEWAY_ZERO_CONFIG.has(provider.id)

    statuses[provider.id] = {
      hasEnvKey,
      aiGatewayCapable,
      envKeyName: provider.envKey,
    }
  }

  return Response.json({
    aiGatewayConnected,
    providers: statuses,
  })
}
