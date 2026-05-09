import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull } from '@/lib/admin/server'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

/** Bundle every number the dashboard needs into one round-trip. */
export async function GET() {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const sb = getServiceClient()
  const now = new Date()
  const last30Start = new Date(now.getTime() - 30 * DAY).toISOString()
  const prev30Start = new Date(now.getTime() - 60 * DAY).toISOString()

  const [
    profilesAll, profilesNew, usage30, usagePrev30, invoicesPaid,
  ] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', last30Start),
    sb.from('usage_logs')
      .select('cost_usd, prompt_tokens, completion_tokens, model, chat_type, provider, created_at, domain, user_id')
      .gte('created_at', last30Start),
    sb.from('usage_logs')
      .select('cost_usd')
      .gte('created_at', prev30Start)
      .lt('created_at', last30Start),
    sb.from('invoices').select('amount_usd, status, created_at').eq('status', 'paid'),
  ])

  const totalUsers = profilesAll.count ?? 0
  const newUsers30d = profilesNew.count ?? 0

  const u30 = usage30.data ?? []
  const spend30 = u30.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
  const tokens30 = u30.reduce((s, r) => s + Number(r.prompt_tokens ?? 0) + Number(r.completion_tokens ?? 0), 0)
  const calls30 = u30.length
  const activeUsers30 = new Set(u30.map(r => r.user_id).filter(Boolean)).size

  const spendPrev30 = (usagePrev30.data ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0)
  const spendDeltaPct = spendPrev30 > 0
    ? Math.round(((spend30 - spendPrev30) / spendPrev30) * 100)
    : (spend30 > 0 ? 100 : 0)

  const mrr = (invoicesPaid.data ?? [])
    .filter(r => new Date(r.created_at).getTime() >= now.getTime() - 30 * DAY)
    .reduce((s, r) => s + Number(r.amount_usd ?? 0), 0)

  // Spend per day (chart)
  const byDay = new Map<string, { spend: number; calls: number }>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY).toISOString().slice(0, 10)
    byDay.set(d, { spend: 0, calls: 0 })
  }
  for (const r of u30) {
    const d = (r.created_at as string).slice(0, 10)
    const b = byDay.get(d); if (!b) continue
    b.spend += Number(r.cost_usd ?? 0); b.calls += 1
  }

  // Model + chat-type + provider mix (last 24 h)
  const oneDayAgo = now.getTime() - DAY
  const u24 = u30.filter(r => new Date(r.created_at as string).getTime() >= oneDayAgo)
  const byModel = new Map<string, number>()
  const byChatType = new Map<string, number>()
  const byProvider = new Map<string, { calls: number; cost: number }>()
  for (const r of u24) {
    const m = (r.model ?? 'unknown') as string
    byModel.set(m, (byModel.get(m) ?? 0) + 1)
    const t = (r.chat_type ?? 'chat') as string
    byChatType.set(t, (byChatType.get(t) ?? 0) + 1)
    const p = ((r.provider ?? 'unknown') as string).toLowerCase() || 'unknown'
    const acc = byProvider.get(p) ?? { calls: 0, cost: 0 }
    acc.calls += 1
    acc.cost += Number(r.cost_usd ?? 0)
    byProvider.set(p, acc)
  }

  return NextResponse.json({
    kpis: {
      total_users: totalUsers,
      new_users_30d: newUsers30d,
      active_users_30d: activeUsers30,
      spend_30d_usd: round2(spend30),
      spend_delta_pct: spendDeltaPct,
      tokens_30d: tokens30,
      calls_30d: calls30,
      mrr_usd: round2(mrr),
    },
    spend_by_day: Array.from(byDay, ([day, v]) => ({ day, ...v })),
    model_mix_24h: Array.from(byModel, ([model, calls]) => ({ model, calls })).sort((a, b) => b.calls - a.calls),
    chat_type_mix_24h: Array.from(byChatType, ([chat_type, calls]) => ({ chat_type, calls })).sort((a, b) => b.calls - a.calls),
    providers_24h: Array.from(byProvider, ([provider, v]) => ({
      provider,
      calls_24h: v.calls,
      cost_24h: round2(v.cost),
    })).sort((a, b) => b.calls_24h - a.calls_24h),
  })
}

function round2(n: number) { return Math.round(n * 100) / 100 }
