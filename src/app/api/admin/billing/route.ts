import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull } from '@/lib/admin/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/billing — invoice list joined with payer email + total
 * top-line numbers (paid / failed / open). Capped at 500 rows; the table is
 * filterable client-side.
 */
export async function GET() {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sb = getServiceClient()
  const { data, error } = await sb
    .from('invoices')
    .select('id, user_id, amount_usd, status, description, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const userIds = [...new Set(rows.map(r => r.user_id).filter((x): x is string => Boolean(x)))]
  const userById = new Map<string, { email: string; name: string }>()
  if (userIds.length > 0) {
    const [{ data: profs }, emailMap] = await Promise.all([
      sb.from('profiles').select('id, first_name, last_name').in('id', userIds),
      fetchEmails(sb, userIds),
    ])
    for (const p of profs ?? []) {
      const email = emailMap.get(p.id) ?? ''
      userById.set(p.id, {
        email,
        name: [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || email.split('@')[0] || '—',
      })
    }
    for (const id of userIds) {
      if (!userById.has(id)) {
        const email = emailMap.get(id) ?? ''
        userById.set(id, { email, name: email.split('@')[0] || '—' })
      }
    }
  }

  const invoices = rows.map(r => ({
    id: r.id,
    amount_usd: Number(r.amount_usd ?? 0),
    status: r.status,
    description: r.description,
    created_at: r.created_at,
    user: r.user_id ? (userById.get(r.user_id) ?? { email: '', name: '—' }) : { email: '', name: '—' },
  }))

  const totals = {
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount_usd, 0),
    open: invoices.filter(i => i.status === 'open' || i.status === 'pending').reduce((s, i) => s + i.amount_usd, 0),
    failed: invoices.filter(i => i.status === 'failed').reduce((s, i) => s + i.amount_usd, 0),
    count: invoices.length,
  }

  // Outstanding credit balances across all users (signed; negative means owed).
  const { data: creditRows } = await sb.from('credits').select('balance_usd')
  const credit_total = (creditRows ?? []).reduce((s, c) => s + Number(c.balance_usd ?? 0), 0)

  return NextResponse.json({ invoices, totals, credit_total })
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
