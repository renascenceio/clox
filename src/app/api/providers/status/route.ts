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

// AI Gateway bridges these providers with no additional per-provider key.
const AI_GATEWAY_ZERO_CONFIG = new Set(['openai', 'anthropic', 'google'])

/**
 * Some providers accept multiple env var names. The primary `envKey` on
 * PROVIDERS is what the admin UI suggests, but Vercel integrations sometimes
 * inject different names (e.g. ANTHROPIC_AUTH_TOKEN vs ANTHROPIC_API_KEY),
 * so we try all known aliases and report which one was found.
 */
const ENV_KEY_ALIASES: Record<string, string[]> = {
  anthropic: ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'],
  google: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'],
}

function resolveEnvValueForProvider(providerId: string, defaultEnvKey: string) {
  const names = ENV_KEY_ALIASES[providerId] ?? [defaultEnvKey]
  for (const name of names) {
    const v = process.env[name]
    if (v && v.trim().length > 0) return { value: v, name }
  }
  return { value: undefined, name: names[0] }
}

export async function GET() {
  const aiGatewayConnected = Boolean(
    // When running on Vercel with the AI Gateway integration enabled, no key
    // is required — the runtime auto-authenticates. If an explicit key is set
    // (e.g. running locally or BYOK), we honour it.
    process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL,
  )

  const statuses: Record<
    string,
    {
      hasEnvKey: boolean
      aiGatewayCapable: boolean
      envKeyName: string
      /** The env var that was actually found, or undefined. Useful for debugging. */
      envKeyFound?: string
    }
  > = {}

  for (const provider of PROVIDERS) {
    const { value, name } = resolveEnvValueForProvider(provider.id, provider.envKey)
    const hasEnvKey = Boolean(value)
    const aiGatewayCapable = aiGatewayConnected && AI_GATEWAY_ZERO_CONFIG.has(provider.id)

    statuses[provider.id] = {
      hasEnvKey,
      aiGatewayCapable,
      envKeyName: provider.envKey,
      envKeyFound: hasEnvKey ? name : undefined,
    }
  }

  return Response.json({
    aiGatewayConnected,
    providers: statuses,
  })
}
