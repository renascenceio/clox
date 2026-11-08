/**
 * Clox plans. One credit = $0.001 of model cost at the gateway's real
 * price (cache reads included), so a plan's credits are its model budget.
 * Unused monthly credits carry over for one more month; credit packs
 * never expire.
 */

export type PlanId = 'free' | 'go' | 'pro' | 'max'
export type BillingCycle = 'monthly' | 'yearly'

export interface Plan {
  id: PlanId
  name: string
  /** USD per month. */
  monthly: number
  /** USD per year (two months free). */
  yearly: number
  /** Credits granted each month. */
  credits: number
  /** Free plan: only low-cost models, and a daily cap. */
  lowCostOnly: boolean
  dailyCap?: number
  blurb: string
  features: string[]
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    monthly: 0,
    yearly: 0,
    credits: 300,
    lowCostOnly: true,
    dailyCap: 100,
    blurb: 'Try Clox with fast models.',
    features: ['300 credits a month', 'Auto, Haiku, Gemini Flash and other fast models', 'Up to 100 credits a day'],
  },
  go: {
    id: 'go',
    name: 'Go',
    monthly: 8,
    yearly: 80,
    credits: 4_500,
    lowCostOnly: false,
    blurb: 'For everyday questions and writing.',
    features: ['4,500 credits a month', 'Every model: Claude, GPT, Gemini and more', 'Documents, web search and browser'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthly: 20,
    yearly: 192,
    credits: 12_000,
    lowCostOnly: false,
    blurb: 'For daily work across every model.',
    features: ['12,000 credits a month', 'Every model, no 5-hour lockouts', 'Unused credits carry over a month'],
  },
  max: {
    id: 'max',
    name: 'Max',
    monthly: 60,
    yearly: 576,
    credits: 40_000,
    lowCostOnly: false,
    blurb: 'For heavy use, agents and long builds.',
    features: ['40,000 credits a month', 'Best rate per credit', 'Unused credits carry over a month'],
  },
}

export const PAID_PLANS: PlanId[] = ['go', 'pro', 'max']

export interface CreditPack {
  id: string
  price: number
  credits: number
}

/** Packs cost a little more per credit than a plan, so heavy users upgrade. */
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'pack-10', price: 10, credits: 5_000 },
  { id: 'pack-25', price: 25, credits: 13_000 },
  { id: 'pack-50', price: 50, credits: 27_000 },
]

export const CREDITS_PER_USD = 1000

export function planFor(id: string | null | undefined): Plan {
  return PLANS[(id ?? 'free') as PlanId] ?? PLANS.free
}

/** Model cost in USD → credits, never less than one for a paid call. */
export function creditsFor(costUsd: number) {
  if (!(costUsd > 0)) return 0
  return Math.max(0.01, Math.round(costUsd * CREDITS_PER_USD * 100) / 100)
}

/** Ids the Free plan may use: input ≤ $1 and output ≤ $5 per 1M tokens. */
export const LOW_COST_LIMIT = { in: 1, out: 5 }

export function formatCredits(n: number) {
  return Math.floor(n).toLocaleString('en-US')
}
