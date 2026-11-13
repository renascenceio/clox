import { NextResponse, type NextRequest } from 'next/server'
import { getServiceClient } from '@/lib/projects/server'
import { verifyProvision } from '@/lib/gaia-sso'

export const dynamic = 'force-dynamic'

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/**
 * POST /api/gaia/provision { ticket } — Gaia CRM's Admin › Users & seats makes a
 * Clox account ahead of someone's first visit (create), or turns Clox off and
 * back on for them (disable / enable). The ticket is signed with GAIA_SSO_SECRET,
 * audience "clox-provision", single use, valid for 60 seconds.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { ticket?: unknown }
  const claims = typeof body.ticket === 'string' ? verifyProvision(body.ticket) : null
  if (!claims) return json({ error: 'Invalid ticket' }, 401)

  const admin = getServiceClient()
  const { error: replay } = await admin.from('sso_nonces').insert({ nonce: claims.nonce, email: claims.email })
  if (replay) return json({ error: 'Ticket already used' }, 409)

  const [first, ...rest] = claims.name.split(/\s+/).filter(Boolean)
  const { error: createError } = await admin.auth.admin.createUser({
    email: claims.email,
    email_confirm: true,
    user_metadata: { first_name: first ?? '', last_name: rest.join(' '), source: 'gaia_crm' },
  })
  const existed = !!createError && /already|exists|registered/i.test(createError.message)
  if (createError && !existed) {
    console.error('[gaia-provision] createUser failed:', createError.message)
    return json({ error: "Clox couldn't make the account." }, 502)
  }
  if (claims.op === 'create') return json({ ok: true, existed })

  // generateLink only looks the account up here; no email is sent.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: claims.email })
  const id = link?.user?.id
  if (linkError || !id) {
    console.error('[gaia-provision] lookup failed:', linkError?.message)
    return json({ error: "Clox couldn't find the account." }, 502)
  }
  const { error: banError } = await admin.auth.admin.updateUserById(id, { ban_duration: claims.op === 'disable' ? '876000h' : 'none' })
  if (banError) {
    console.error('[gaia-provision] ban switch failed:', banError.message)
    return json({ error: "Clox couldn't change the account." }, 502)
  }
  return json({ ok: true, existed })
}
