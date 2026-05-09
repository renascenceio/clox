import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull } from '@/lib/admin/server'

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
