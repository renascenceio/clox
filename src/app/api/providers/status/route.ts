import { gatewayProviders } from '@/lib/gateway/catalog'
import { gatewayConnected } from '@/lib/gateway/server'

/**
 * Which providers can run right now. Every model is served by the Vercel
 * AI Gateway, so a provider is usable exactly when the server can
 * authenticate to the gateway (API key or Vercel OIDC token).
 */
export async function GET() {
  const connected = await gatewayConnected()
  const providers: Record<string, { hasEnvKey: boolean; aiGatewayCapable: boolean; envKeyName: string }> = {}
  for (const p of gatewayProviders()) {
    providers[p.id] = { hasEnvKey: false, aiGatewayCapable: connected, envKeyName: 'AI_GATEWAY_API_KEY' }
  }
  return Response.json({
    aiGatewayConnected: connected,
    authMode: process.env.AI_GATEWAY_API_KEY ? 'api-key' : connected ? 'oidc' : 'none',
    providers,
  })
}
