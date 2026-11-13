import { type NextRequest } from 'next/server'
import { crmSignInUrl, safeNext } from '@/lib/gaia-sso-config'

export const dynamic = 'force-dynamic'

/** GET /auth/gaia/start?next=… — "Continue with Gaia CRM": goes to the
 *  CRM, which asks them to sign in there if needed, then comes back. */
export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get('next'))
  if (!process.env.GAIA_SSO_SECRET) {
    return new Response(null, { status: 303, headers: { Location: `/login?redirect=${encodeURIComponent(next)}&sso=off` } })
  }
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').split(',')[0].trim()
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  const origin = `${local ? 'http' : 'https'}://${host}`
  return new Response(null, { status: 303, headers: { Location: crmSignInUrl(origin, next, { prompt: 'login' }), 'Cache-Control': 'no-store' } })
}
