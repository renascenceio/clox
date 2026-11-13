import { getCallerForLogging } from '@/lib/projects/usage'
import { getServiceClient } from '@/lib/projects/server'
import { checkCredit, isUncharged } from '@/lib/credits'
import { companyPlanFor, planFor } from '@/lib/plans'

export const dynamic = 'force-dynamic'

/** GET /api/billing — the caller's plan, credits by kind, and this period's use. */
export async function GET() {
  const caller = await getCallerForLogging()
  if (!caller) return Response.json({ error: 'signin' }, { status: 401 })
  // Starts a company plan or a new month first, so the figures are current.
  if (companyPlanFor(caller.domain)) await checkCredit()
  const sb = getServiceClient()
  const [{ data: profile }, { data: credit }] = await Promise.all([
    sb.from('profiles').select('plan, role').eq('id', caller.userId).maybeSingle(),
    sb.from('credits')
      .select('plan_credits, carry_credits, topup_credits, balance_credits, period_start, period_end')
      .eq('user_id', caller.userId)
      .maybeSingle(),
  ])
  const plan = planFor(profile?.plan)
  const since = credit?.period_start ?? new Date(Date.now() - 30 * 86400_000).toISOString()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const { data: rows } = await sb
    .from('usage_logs')
    .select('credits, created_at')
    .eq('user_id', caller.userId)
    .gte('created_at', since < today.toISOString() ? since : today.toISOString())
  const used = (rows ?? []).filter(r => r.created_at >= since).reduce((s, r) => s + Number(r.credits ?? 0), 0)
  const usedToday = (rows ?? []).filter(r => r.created_at >= today.toISOString()).reduce((s, r) => s + Number(r.credits ?? 0), 0)
  return Response.json(
    {
      plan: plan.id,
      unlimited: profile?.role === 'super_admin' || isUncharged(caller.domain),
      credits: {
        plan: Number(credit?.plan_credits ?? 0),
        carry: Number(credit?.carry_credits ?? 0),
        topup: Number(credit?.topup_credits ?? 0),
        total: Number(credit?.balance_credits ?? 0),
      },
      periodEnd: credit?.period_end ?? null,
      used,
      usedToday,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
