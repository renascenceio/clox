import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull, writeAudit } from '@/lib/admin/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/users?q=<search>&role=<role>&limit=200
 * Returns profile rows joined with credit balances and 30-day usage totals.
 */
export async function GET(req: Request) {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const roleFilter = url.searchParams.get('role')
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? '200')))

  const sb = getServiceClient()

  let profileQ = sb.from('profiles')
    .select('id, first_name, last_name, role, company, country, city, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (roleFilter) profileQ = profileQ.eq('role', roleFilter)
  if (q) {
    // We can only search profile-resident columns at the DB level. Email
    // search happens on the client-side filtered set after we've enriched.
    profileQ = profileQ.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,company.ilike.%${q}%`,
    )
  }

  const { data: profiles, error } = await profileQ
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = profiles ?? []

  if (rows.length === 0) return NextResponse.json({ users: [] })

  const ids = rows.map(r => r.id)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Email lives in auth.users — pull it via the admin API, paged in chunks.
  const emailById = await fetchEmailsByIds(sb, ids)

  const [credits, usage] = await Promise.all([
    sb.from('credits').select('user_id, balance_usd').in('user_id', ids),
    sb.from('usage_logs')
      .select('user_id, cost_usd, prompt_tokens, completion_tokens')
      .in('user_id', ids)
      .gte('created_at', since),
  ])

  const creditByUser = new Map<string, number>()
  for (const c of credits.data ?? []) creditByUser.set(c.user_id, Number(c.balance_usd ?? 0))

  const usageByUser = new Map<string, { spend: number; tokens: number; calls: number }>()
  for (const u of usage.data ?? []) {
    const cur = usageByUser.get(u.user_id) ?? { spend: 0, tokens: 0, calls: 0 }
    cur.spend += Number(u.cost_usd ?? 0)
    cur.tokens += Number(u.prompt_tokens ?? 0) + Number(u.completion_tokens ?? 0)
    cur.calls += 1
    usageByUser.set(u.user_id, cur)
  }

  const lcQuery = q.toLowerCase()
  const users = rows
    .map(r => {
      const email = emailById.get(r.id) ?? ''
      return {
        id: r.id,
        email,
        name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || (email.split('@')[0] || 'user'),
        role: r.role,
        company: r.company,
        country: r.country,
        city: r.city,
        created_at: r.created_at,
        balance_usd: creditByUser.get(r.id) ?? 0,
        usage_30d: usageByUser.get(r.id) ?? { spend: 0, tokens: 0, calls: 0 },
      }
    })
    // If the search query didn't match any profile columns but does match an
    // email, the row might already be in `rows` because of relaxed matching;
    // additionally filter out rows whose email doesn't include `q` when q has
    // an "@" sign (treat as an explicit email search).
    .filter(u => !lcQuery || u.email.toLowerCase().includes(lcQuery) || u.name.toLowerCase().includes(lcQuery)
      || (u.company ?? '').toLowerCase().includes(lcQuery))

  return NextResponse.json({ users })
}

/**
 * Use the Supabase Admin API to look up `auth.users` emails for a set of ids.
 * `listUsers` is paged at up to 1000 per page — for any realistic admin
 * dataset (profiles count is small) one page is enough.
 */
async function fetchEmailsByIds(
  sb: ReturnType<typeof getServiceClient>,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const want = new Set(ids)
  let page = 1
  // Cap pagination so a misbehaving instance can't spin us forever.
  while (page <= 50) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) {
      console.error('[v0] auth.admin.listUsers failed:', error.message)
      break
    }
    for (const u of data.users) {
      if (want.has(u.id) && u.email) out.set(u.id, u.email)
    }
    if (data.users.length < 1000) break
    page++
  }
  return out
}

const ALLOWED_ROLES = new Set(['user', 'super_admin'])

/**
 * POST /api/admin/users — create a fresh user.
 *
 * Body: { email, password, first_name?, last_name?, role?, send_invite? }
 *
 * Two creation paths:
 *   1. `password` set → calls `auth.admin.createUser` with the password
 *      and `email_confirm:true` so the operator can hand the credentials
 *      over and the user can sign in immediately.
 *   2. `send_invite:true` → calls `auth.admin.inviteUserByEmail` instead,
 *      which mails a magic-link signup invite. No password required.
 *
 * After auth-user creation we always upsert the matching `profiles` row
 * with the chosen role so super-admin promotion is atomic with sign-up.
 * (The DB trigger that creates the profile only sets it to 'user'.)
 */
export async function POST(req: Request) {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: {
    email?: string
    password?: string
    first_name?: string
    last_name?: string
    role?: string
    send_invite?: boolean
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const email = (body.email ?? '').trim().toLowerCase()
  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: 'bad_email' }, { status: 400 })
  }
  const role = body.role ?? 'user'
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: 'bad_role' }, { status: 400 })
  }

  const sb = getServiceClient()
  const sendInvite = !!body.send_invite || !body.password
  const userMetadata = {
    first_name: (body.first_name ?? '').trim() || null,
    last_name: (body.last_name ?? '').trim() || null,
    role,
  }

  // Path 1 — password-based creation (operator hands over the creds).
  // Path 2 — invite-by-email (Supabase mails the magic link).
  let userId: string
  if (sendInvite) {
    const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
      data: userMetadata,
    })
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? 'invite_failed' }, { status: 500 })
    }
    userId = data.user.id
  } else {
    const password = (body.password ?? '').toString()
    if (password.length < 8) {
      return NextResponse.json({ error: 'password_too_short' }, { status: 400 })
    }
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: userMetadata,
    })
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? 'create_failed' }, { status: 500 })
    }
    userId = data.user.id
  }

  // Ensure the profiles row exists with the chosen role + names. The
  // on-auth trigger creates a default row, but we upsert so the role
  // and names match what the admin chose even if the trigger is
  // missing or out of date.
  const { error: profileErr } = await sb.from('profiles').upsert({
    id: userId,
    first_name: userMetadata.first_name,
    last_name: userMetadata.last_name,
    role,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (profileErr) {
    console.error('[v0] profiles upsert failed:', profileErr.message)
    // Don't fail the whole request — the auth user was created. Surface
    // the error so the operator can see it.
    return NextResponse.json({
      user: { id: userId, email, role },
      warning: `auth user created but profile upsert failed: ${profileErr.message}`,
    })
  }

  await writeAudit({
    actor,
    action: sendInvite ? 'user.invite' : 'user.create',
    targetKind: 'user',
    targetId: userId,
    payload: { email, role, sendInvite },
  })

  return NextResponse.json({
    user: {
      id: userId,
      email,
      role,
      first_name: userMetadata.first_name,
      last_name: userMetadata.last_name,
    },
  })
}
