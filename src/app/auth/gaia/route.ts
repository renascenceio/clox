import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceClient } from '@/lib/projects/server'
import { safeNext, verifyTicket } from '@/lib/gaia-sso'

export const dynamic = 'force-dynamic'

// Relative Location: request.url carries the server's internal host behind
// proxies and previews.
const go = (location: string) => new Response(null, { status: 303, headers: { Location: location, 'Cache-Control': 'no-store' } })

const toLogin = (next: string, reason: string) =>
  go(`/login?redirect=${encodeURIComponent(next)}&sso=${encodeURIComponent(reason)}`)

/**
 * GET /auth/gaia?ticket=…&next=… — the CRM sends people here after
 * checking they're signed in there. A valid ticket signs them in to Omma
 * (making the account the first time); ?sso=none means they aren't signed
 * in to the CRM, so they land on the normal sign-in page.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const next = safeNext(params.get('next'))
  const ticket = params.get('ticket')
  // none = not signed in to the CRM; denied = an administrator hasn't given them Omma.
  const sso = params.get('sso')
  if (!ticket) return toLogin(next, sso === 'none' || sso === 'denied' ? sso : 'missing')

  const claims = verifyTicket(ticket)
  if (!claims) return toLogin(next, 'invalid')

  const admin = getServiceClient()
  const { error: replay } = await admin.from('sso_nonces').insert({ nonce: claims.nonce, email: claims.email })
  if (replay) return toLogin(next, 'used')

  const [first, ...rest] = claims.name.split(/\s+/).filter(Boolean)
  const { error: createError } = await admin.auth.admin.createUser({
    email: claims.email,
    email_confirm: true,
    user_metadata: { first_name: first ?? '', last_name: rest.join(' '), source: 'gaia_crm' },
  })
  if (createError && !/already|exists|registered/i.test(createError.message)) {
    console.error('[gaia-sso] createUser failed:', createError.message)
    return toLogin(next, 'failed')
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: claims.email })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) {
    console.error('[gaia-sso] generateLink failed:', linkError?.message)
    return toLogin(next, 'failed')
  }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  if (verifyError) {
    console.error('[gaia-sso] verifyOtp failed:', verifyError.message)
    return toLogin(next, 'failed')
  }

  // Old tickets are only kept long enough to refuse a replay.
  await admin.from('sso_nonces').delete().lt('created_at', new Date(Date.now() - 86_400_000).toISOString())

  return go(next)
}
