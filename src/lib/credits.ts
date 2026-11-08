import { getServiceClient } from '@/lib/projects/server'
import { getCallerForLogging } from '@/lib/projects/usage'
import { FREE_DOMAINS } from '@/domains/text-generation/services/pricing'

type Caller = NonNullable<Awaited<ReturnType<typeof getCallerForLogging>>>

/** True when this account isn't charged (free email domains). */
export function isUncharged(domain: string | null | undefined) {
  return !!domain && FREE_DOMAINS.includes(domain.toLowerCase())
}

/**
 * Gate for every route that spends money on a model: the caller must be
 * signed in, active, and have credit left (free domains and super admins
 * are never blocked). Returns the caller, or a ready-to-send Response.
 */
export async function checkCredit(): Promise<
  { caller: Caller; blocked: null } | { caller: null; blocked: Response }
> {
  const caller = await getCallerForLogging()
  if (!caller) {
    return { caller: null, blocked: Response.json({ success: false, error: 'Sign in to use Clox.' }, { status: 401 }) }
  }
  const sb = getServiceClient()
  const [{ data: profile }, { data: credit }] = await Promise.all([
    sb.from('profiles').select('role, is_active').eq('id', caller.userId).maybeSingle(),
    sb.from('credits').select('balance_usd').eq('user_id', caller.userId).maybeSingle(),
  ])
  if (profile && profile.is_active === false) {
    return { caller: null, blocked: Response.json({ success: false, error: 'This account is suspended.' }, { status: 403 }) }
  }
  if (profile?.role === 'super_admin' || isUncharged(caller.domain)) return { caller, blocked: null }
  if (Number(credit?.balance_usd ?? 0) <= 0) {
    return {
      caller: null,
      blocked: Response.json(
        { success: false, error: 'You’ve used all your credit. Add more in Settings › Billing to keep going.' },
        { status: 402 },
      ),
    }
  }
  return { caller, blocked: null }
}

/** Takes the cost of a call off the caller's balance (never below zero). */
export async function chargeCredit(userId: string, domain: string | null | undefined, costUsd: number) {
  if (!(costUsd > 0) || isUncharged(domain)) return
  const { error } = await getServiceClient().rpc('deduct_credits', { p_user_id: userId, p_amount: costUsd })
  if (error) console.error('[v0] deduct_credits failed:', error.message)
}
