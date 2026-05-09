/**
 * Server-side helpers for the Projects v2 surface.
 *
 *   - requireUser()                    — load auth.users row (or 401 throw)
 *   - getProjectForViewer()            — load a project the caller can see
 *   - getProjectMembership()           — load the caller's role in a project
 *   - assertProjectAdmin()             — throw if caller isn't owner/admin
 *   - assertBudget()                   — throw if a generation would bust the cap
 *   - logActivity()                    — append-only audit event
 *
 * Service-role client is reserved for budget checks and audit writes that
 * must bypass RLS; everything else uses the request-bound client so RLS
 * does the right thing for free.
 */
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const SERVICE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY

export function getServiceClient(): SupabaseClient {
  if (!SERVICE_URL || !SERVICE_ROLE) {
    throw new Error('Service role client is not configured')
  }
  return createServiceClient(SERVICE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'protonmail.com', 'live.com', 'msn.com', 'me.com',
  'aol.com', 'fastmail.com', 'pm.me', 'duck.com', 'mail.com',
])

export function isGenericDomain(emailOrDomain: string): boolean {
  const d = (emailOrDomain.includes('@')
    ? emailOrDomain.split('@')[1]
    : emailOrDomain
  ).trim().toLowerCase()
  return !d || GENERIC_DOMAINS.has(d)
}

export function emailDomain(email: string): string {
  return (email.split('@')[1] || '').trim().toLowerCase()
}

// ---------- Authn helpers ----------------------------------------------------

export async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    const e = new Error('Not authenticated')
    ;(e as Error & { status?: number }).status = 401
    throw e
  }
  return { user, supabase }
}

// ---------- Project helpers --------------------------------------------------

export interface ProjectRow {
  id: string
  title: string
  description: string | null
  model: string
  owner_id: string
  owner_email: string
  owner_domain: string | null
  credit_budget_usd: number | null
  credit_spent_usd: number
  budget_period: 'lifetime' | 'monthly'
  budget_resets_at: string | null
  archived_at: string | null
  allow_external: boolean
  system_prompt: string | null
  default_modality: 'text' | 'image' | 'video' | 'audio' | 'research' | 'code'
  temperature: number
  max_tokens: number
  last_activity_at: string
  created_at: string
  updated_at: string
}

export async function getProjectForViewer(projectId: string) {
  const { user, supabase } = await requireUser()

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle()

  if (error) throw error
  if (!project) {
    const e = new Error('Project not found') as Error & { status?: number }
    e.status = 404
    throw e
  }

  // RLS already enforces visibility, but we double-check the role for response
  // shaping.
  const { data: member } = await supabase
    .from('project_members')
    .select('id, role, credit_limit_usd, credit_spent_usd, joined_at')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle()

  return { user, supabase, project: project as ProjectRow, member }
}

export async function assertProjectAdmin(projectId: string) {
  const ctx = await getProjectForViewer(projectId)
  const role = ctx.member?.role
  if (role !== 'owner' && role !== 'admin') {
    const e = new Error('Forbidden') as Error & { status?: number }
    e.status = 403
    throw e
  }
  return ctx
}

export async function assertProjectOwner(projectId: string) {
  const ctx = await getProjectForViewer(projectId)
  if (ctx.project.owner_id !== ctx.user.id) {
    const e = new Error('Forbidden') as Error & { status?: number }
    e.status = 403
    throw e
  }
  return ctx
}

// ---------- Budget enforcement ----------------------------------------------

/**
 * Estimate-based gate. Call this *before* spinning up an LLM/image/video job
 * when the chat is attached to a project. Throws a 402-like error with a
 * human-readable reason if the project (or this member's per-seat cap) is
 * out of budget.
 *
 * `estimatedCostUsd` is best-effort; pass 0 to perform a "any budget left at
 * all?" pre-check.
 */
export async function assertBudget(opts: {
  projectId: string
  userId: string
  estimatedCostUsd?: number
}) {
  const supabase = getServiceClient()
  const est = Math.max(0, Number(opts.estimatedCostUsd ?? 0))

  // Reset monthly budget if the window has elapsed.
  await maybeResetMonthlyBudget(opts.projectId)

  const { data: project, error } = await supabase
    .from('projects')
    .select('credit_budget_usd, credit_spent_usd, archived_at, budget_period, budget_resets_at')
    .eq('id', opts.projectId)
    .maybeSingle()

  if (error) throw error
  if (!project) {
    const e = new Error('Project not found') as Error & { status?: number }
    e.status = 404
    throw e
  }
  if (project.archived_at) {
    const e = new Error('Project is archived') as Error & { status?: number }
    e.status = 423
    throw e
  }

  if (project.credit_budget_usd != null) {
    const remaining = Number(project.credit_budget_usd) - Number(project.credit_spent_usd)
    if (remaining <= 0 || remaining < est) {
      const e = new Error(
        `Project budget reached (${formatUsd(project.credit_spent_usd)} of ${formatUsd(project.credit_budget_usd)} spent). Top up or raise the cap to continue.`,
      ) as Error & { status?: number }
      e.status = 402
      throw e
    }
  }

  // Per-member cap
  const { data: member } = await supabase
    .from('project_members')
    .select('credit_limit_usd, credit_spent_usd, role')
    .eq('project_id', opts.projectId)
    .eq('user_id', opts.userId)
    .maybeSingle()

  if (member?.credit_limit_usd != null) {
    const memberRemaining = Number(member.credit_limit_usd) - Number(member.credit_spent_usd)
    if (memberRemaining <= 0 || memberRemaining < est) {
      const e = new Error(
        `Your per-seat limit on this project is ${formatUsd(member.credit_limit_usd)}, of which ${formatUsd(member.credit_spent_usd)} is already spent. Ask an admin to raise it.`,
      ) as Error & { status?: number }
      e.status = 402
      throw e
    }
  }

  return { project, member }
}

async function maybeResetMonthlyBudget(projectId: string) {
  const supabase = getServiceClient()
  const { data: row } = await supabase
    .from('projects')
    .select('budget_period, budget_resets_at')
    .eq('id', projectId)
    .maybeSingle()
  if (!row || row.budget_period !== 'monthly') return
  if (!row.budget_resets_at) return
  if (new Date(row.budget_resets_at).getTime() > Date.now()) return

  // Window expired — reset spend and bump the next reset by one month.
  const next = new Date(row.budget_resets_at)
  while (next.getTime() <= Date.now()) next.setMonth(next.getMonth() + 1)

  await supabase
    .from('projects')
    .update({ credit_spent_usd: 0, budget_resets_at: next.toISOString() })
    .eq('id', projectId)

  // Reset every member's per-seat spend too.
  await supabase
    .from('project_members')
    .update({ credit_spent_usd: 0 })
    .eq('project_id', projectId)
}

function formatUsd(v: number | string | null | undefined) {
  const n = Number(v ?? 0)
  return `$${n.toFixed(2)}`
}

// ---------- Activity log -----------------------------------------------------

export async function logActivity(opts: {
  projectId: string
  actorId: string | null
  actorEmail: string | null
  action: string
  targetKind?: string | null
  targetId?: string | null
  payload?: Record<string, unknown>
}) {
  const supabase = getServiceClient()
  await supabase.from('project_activity').insert({
    project_id: opts.projectId,
    actor_id: opts.actorId,
    actor_email: opts.actorEmail,
    action: opts.action,
    target_kind: opts.targetKind ?? null,
    target_id: opts.targetId ?? null,
    payload: opts.payload ?? {},
  })
}

// ---------- Invite token helper ---------------------------------------------

export function generateInviteToken(): string {
  // 24 url-safe bytes — ~32 base64url characters.
  const bytes = new Uint8Array(24)
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Buffer.from(bytes).toString('base64url')
}
