import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull } from '@/lib/admin/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/usage?days=30&provider=&model=&domain=&limit=500
 * Returns the most recent usage_logs rows along with simple aggregates so the
 * /admin/usage page can show "spend by day", "spend by provider" without a
 * second round trip.
 */
export async function GET(req: Request) {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const days = Math.min(180, Math.max(1, Number(url.searchParams.get('days') ?? '30')))
  const provider = url.searchParams.get('provider')
  const model = url.searchParams.get('model')
  const domain = url.searchParams.get('domain')
  const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get('limit') ?? '500')))

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const sb = getServiceClient()

  let q = sb.from('usage_logs')
    .select('id, user_id, provider, model, prompt_tokens, completion_tokens, cost_usd, domain, chat_type, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (provider) q = q.eq('provider', provider)
  if (model) q = q.eq('model', model)
  if (domain) q = q.eq('domain', domain)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = data ?? []

  // Roll up by day + by provider in-app — keeps the API self-contained.
  const byDay = new Map<string, { spend: number; calls: number; tokens: number }>()
  const byProvider = new Map<string, { spend: number; calls: number }>()
  const byModel = new Map<string, { spend: number; calls: number }>()
  const byChatType = new Map<string, { spend: number; calls: number }>()

  for (const r of rows) {
    const day = (r.created_at as string).slice(0, 10)
    const cost = Number(r.cost_usd ?? 0)
    const tokens = Number(r.prompt_tokens ?? 0) + Number(r.completion_tokens ?? 0)
    const dayBucket = byDay.get(day) ?? { spend: 0, calls: 0, tokens: 0 }
    dayBucket.spend += cost; dayBucket.calls += 1; dayBucket.tokens += tokens
    byDay.set(day, dayBucket)

    const prov = (r.provider ?? 'unknown') as string
    const provBucket = byProvider.get(prov) ?? { spend: 0, calls: 0 }
    provBucket.spend += cost; provBucket.calls += 1
    byProvider.set(prov, provBucket)

    const m = (r.model ?? 'unknown') as string
    const modelBucket = byModel.get(m) ?? { spend: 0, calls: 0 }
    modelBucket.spend += cost; modelBucket.calls += 1
    byModel.set(m, modelBucket)

    const t = (r.chat_type ?? 'chat') as string
    const ctBucket = byChatType.get(t) ?? { spend: 0, calls: 0 }
    ctBucket.spend += cost; ctBucket.calls += 1
    byChatType.set(t, ctBucket)
  }

  return NextResponse.json({
    rows,
    aggregates: {
      by_day: [...byDay.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
      by_provider: [...byProvider.entries()].map(([provider, v]) => ({ provider, ...v })).sort((a, b) => b.spend - a.spend),
      by_model: [...byModel.entries()].map(([model, v]) => ({ model, ...v })).sort((a, b) => b.spend - a.spend),
      by_chat_type: [...byChatType.entries()].map(([chat_type, v]) => ({ chat_type, ...v })).sort((a, b) => b.spend - a.spend),
    },
  })
}
