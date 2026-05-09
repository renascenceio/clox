import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull } from '@/lib/admin/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/live?limit=20 — latest usage_logs entries joined with the
 * acting user's email + name. Polled by the dashboard live feed.
 */
export async function GET(req: Request) {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? '20')))

  const sb = getServiceClient()
  const { data, error } = await sb
    .from('usage_logs')
    .select('id, user_id, provider, model, chat_type, cost_usd, prompt_tokens, completion_tokens, domain, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const userIds = Array.from(new Set(rows.map(r => r.user_id).filter((x): x is string => Boolean(x))))
  let nameByUser = new Map<string, { name: string; email: string }>()
  if (userIds.length > 0) {
    const [{ data: profs }, emailMap] = await Promise.all([
      sb.from('profiles').select('id, first_name, last_name').in('id', userIds),
      fetchEmails(sb, userIds),
    ])
    nameByUser = new Map(
      (profs ?? []).map(p => {
        const email = emailMap.get(p.id) ?? ''
        return [
          p.id,
          {
            name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || email.split('@')[0] || '—',
            email,
          },
        ]
      }),
    )
    // Profiles row might be missing for legacy users; surface email-only entries too.
    for (const id of userIds) {
      if (!nameByUser.has(id)) {
        const email = emailMap.get(id) ?? ''
        nameByUser.set(id, { name: email.split('@')[0] || '—', email })
      }
    }
  }

  const entries = rows.map(r => ({
    id: r.id,
    created_at: r.created_at,
    provider: r.provider,
    model: r.model,
    chat_type: r.chat_type ?? 'chat',
    cost_usd: Number(r.cost_usd ?? 0),
    prompt_tokens: Number(r.prompt_tokens ?? 0),
    completion_tokens: Number(r.completion_tokens ?? 0),
    domain: r.domain ?? null,
    user: r.user_id ? (nameByUser.get(r.user_id) ?? { name: '—', email: '' }) : { name: '—', email: '' },
  }))

  return NextResponse.json({ entries })
}

async function fetchEmails(
  sb: ReturnType<typeof getServiceClient>,
  ids: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const want = new Set(ids)
  let page = 1
  while (page <= 50) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) break
    for (const u of data.users) if (want.has(u.id) && u.email) out.set(u.id, u.email)
    if (data.users.length < 1000) break
    page++
  }
  return out
}
