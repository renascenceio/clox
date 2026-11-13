import { getServiceClient } from '@/lib/projects/server'
import { getCallerForLogging } from '@/lib/projects/usage'
import { FREE_DOMAINS } from '@/domains/text-generation/services/pricing'
import { TEXT_PRICES } from '@/lib/gateway/prices.generated'
import { AUTO_MODEL_ID } from '@/lib/auto-model'
import { LOW_COST_LIMIT, companyPlanFor, creditsFor, planFor, type Plan } from '@/lib/plans'

type Caller = NonNullable<Awaited<ReturnType<typeof getCallerForLogging>>>

/** True when this account isn't charged (free email domains). */
export function isUncharged(domain: string | null | undefined) {
  return !!domain && FREE_DOMAINS.includes(domain.toLowerCase())
}

/** Models the Free plan may use. */
export function isLowCostModel(modelId: string) {
  if (modelId === AUTO_MODEL_ID) return true
  const p = TEXT_PRICES[modelId]
  return Boolean(p && p.in <= LOW_COST_LIMIT.in && p.out <= LOW_COST_LIMIT.out)
}

function block(status: number, error: string, code: string) {
  return { caller: null, plan: null, blocked: Response.json({ success: false, error, code }, { status }) } as const
}

/**
 * Gate for every route that spends money on a model: the caller must be
 * signed in, active, and have credits left (free domains and super admins
 * are never blocked). The Free plan also renews itself here each month,
 * is limited to low-cost models, and has a daily cap.
 */
export async function checkCredit(opts: { model?: string } = {}): Promise<
  | { caller: Caller; plan: Plan; blocked: null }
  | { caller: null; plan: null; blocked: Response }
> {
  const caller = await getCallerForLogging()
  if (!caller) return block(401, 'Sign in to use Clox.', 'signin')
  const sb = getServiceClient()
  const [{ data: profile }, { data: credit }] = await Promise.all([
    sb.from('profiles').select('role, is_active, plan').eq('id', caller.userId).maybeSingle(),
    sb.from('credits').select('balance_credits, period_end, subscription_status').eq('user_id', caller.userId).maybeSingle(),
  ])
  if (profile && profile.is_active === false) return block(403, 'This account is suspended.', 'suspended')
  let plan = planFor(profile?.plan)
  if (profile?.role === 'super_admin' || isUncharged(caller.domain)) return { caller, plan, blocked: null }

  let balance = Number(credit?.balance_credits ?? 0)
  let periodOver = !credit?.period_end || new Date(credit.period_end).getTime() <= Date.now()

  // Company emails start on their company plan (an admin can still move
  // someone to another plan; only the default Free plan is replaced).
  const company = companyPlanFor(caller.domain)
  if (credit && company && plan.id === 'free') {
    await sb.from('profiles').update({ plan: company.id, updated_at: new Date().toISOString() }).eq('id', caller.userId)
    plan = company
    periodOver = true
  }

  // Paid plans renew from Stripe's invoice; Free and company plans renew here.
  if (credit && periodOver && (plan.id === 'free' || plan.company)) {
    const next = new Date()
    next.setUTCMonth(next.getUTCMonth() + 1)
    const { data } = await sb.rpc('renew_credits', {
      p_user_id: caller.userId, p_grant: plan.credits, p_period_end: next.toISOString(), p_change: false,
    })
    if (data != null) balance = Number(data)
    // A company allowance is a fixed monthly limit: last month's leftover
    // doesn't carry over.
    if (plan.company) {
      const { data: row } = await sb
        .from('credits')
        .update({ carry_credits: 0 })
        .eq('user_id', caller.userId)
        .select('balance_credits')
        .maybeSingle()
      if (row) balance = Number(row.balance_credits)
    }
  }

  if (plan.lowCostOnly && opts.model && !isLowCostModel(opts.model)) {
    return block(402, `The Free plan includes Auto and fast models like Haiku and Gemini Flash. Upgrade to use this model.`, 'upgrade_model')
  }
  if (balance <= 0) {
    return block(402, 'You’ve used all your credits. Upgrade your plan or add credits in Settings › Billing.', 'no_credits')
  }
  if (plan.dailyCap) {
    const since = new Date()
    since.setUTCHours(0, 0, 0, 0)
    const { data: rows } = await sb
      .from('usage_logs')
      .select('credits')
      .eq('user_id', caller.userId)
      .gte('created_at', since.toISOString())
    const today = (rows ?? []).reduce((s, r) => s + Number(r.credits ?? 0), 0)
    if (today >= plan.dailyCap) {
      return block(429, `You’ve used today’s ${plan.dailyCap} Free credits. They reset at midnight UTC, or upgrade for more.`, 'daily_cap')
    }
  }
  return { caller, plan, blocked: null }
}

/** Takes the cost of a call off the caller's credits (never below zero). */
export async function chargeCredit(userId: string, domain: string | null | undefined, costUsd: number) {
  const credits = creditsFor(costUsd)
  if (!(credits > 0) || isUncharged(domain)) return
  const { error } = await getServiceClient().rpc('spend_credits', { p_user_id: userId, p_amount: credits })
  if (error) console.error('[v0] spend_credits failed:', error.message)
}
