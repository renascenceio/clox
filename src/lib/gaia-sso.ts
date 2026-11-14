import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

export { safeNext } from './gaia-sso-config'

/**
 * Sign-in from Sota OS (crm.gaiarealty.ae). The two apps use different
 * Supabase projects, so they can't share a session. Instead Omma sends a
 * signed-out visitor to the CRM's /auth/clox; when they're signed in there,
 * the CRM sends them back to /auth/gaia with a short-lived ticket signed
 * with GAIA_SSO_SECRET (the same value is set in both projects).
 *
 * Ticket = "v1.<base64url JSON>.<base64url HMAC-SHA256 of "v1.<body>">"
 */

export interface GaiaTicket {
  email: string
  name: string
  nonce: string
  exp: number
}

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export type ProvisionOp = 'create' | 'disable' | 'enable'

/** Admin › Users & seats in the CRM making, turning off or back on a Omma account. */
export function verifyProvision(ticket: string): (GaiaTicket & { op: ProvisionOp }) | null {
  const data = readTicket(ticket, 'clox-provision')
  if (!data) return null
  const op = (data as { op?: unknown }).op
  if (op !== 'create' && op !== 'disable' && op !== 'enable') return null
  return { ...data, op }
}

export function verifyTicket(ticket: string): GaiaTicket | null {
  return readTicket(ticket, 'clox')
}

function readTicket(ticket: string, audience: string): (GaiaTicket & Record<string, unknown>) | null {
  const secret = process.env.GAIA_SSO_SECRET
  if (!secret || typeof ticket !== 'string') return null
  const [version, body, sig] = ticket.split('.')
  if (version !== 'v1' || !body || !sig) return null
  const expected = Buffer.from(b64url(createHmac('sha256', secret).update(`${version}.${body}`).digest()))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<GaiaTicket> & { aud?: string; op?: unknown }
    if (data.aud !== audience) return null
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
    if (typeof data.email !== 'string' || !data.email.includes('@') || typeof data.nonce !== 'string') return null
    return { email: data.email.trim().toLowerCase(), name: String(data.name ?? '').trim(), nonce: data.nonce, exp: data.exp, op: data.op }
  } catch {
    return null
  }
}
