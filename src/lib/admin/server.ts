/**
 * Admin server helpers — guards, service-role client, and audit log writer.
 * All admin pages and /api/admin routes must go through `requireSuperAdmin`
 * so non-admins never see (or mutate) anything.
 */
import 'server-only'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createSb } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

/** Identity surfaced to admin pages: who is logged in + their role row. */
export interface AdminIdentity {
  userId: string
  email: string
  fullName: string
  role: string
}

/**
 * Server-side gate. Loads the session, then the profiles row, and redirects
 * silently to /text if the user isn't a super_admin. Returns the identity so
 * pages can reuse it (greeting, audit log actor, etc.).
 *
 * Use inside any Server Component (admin layout, admin RSC pages) or Route
 * Handler that should be admin-only.
 */
export async function requireSuperAdmin(): Promise<AdminIdentity> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (error || !profile || profile.role !== 'super_admin') {
    redirect('/text?reason=not_admin')
  }

  const first = (profile.first_name ?? '').trim()
  const last = (profile.last_name ?? '').trim()
  const fullName = [first, last].filter(Boolean).join(' ') || (user.email ?? 'admin')

  return {
    userId: user.id,
    email: user.email ?? '',
    fullName,
    role: profile.role,
  }
}

/**
 * Soft variant for Route Handlers — returns null instead of redirecting.
 * Lets the handler decide whether to 401/403 or no-op.
 */
export async function getSuperAdminOrNull(): Promise<AdminIdentity | null> {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, first_name, last_name')
      .eq('id', user.id)
      .single()
    if (!profile || profile.role !== 'super_admin') return null
    const first = (profile.first_name ?? '').trim()
    const last = (profile.last_name ?? '').trim()
    return {
      userId: user.id,
      email: user.email ?? '',
      fullName: [first, last].filter(Boolean).join(' ') || (user.email ?? 'admin'),
      role: profile.role,
    }
  } catch {
    return null
  }
}

/**
 * Service-role client. Bypasses RLS — use only from server code that has
 * already authenticated the caller as super_admin. Never expose this to the
 * browser.
 */
export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service role env vars missing (SUPABASE_SERVICE_ROLE_KEY).')
  }
  return createSb(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Append an entry to admin_audit_log. All admin writes should call this so
 * /admin/audit shows a complete history. Failures are swallowed — we never
 * want audit logging to break an admin action.
 */
export async function writeAudit(opts: {
  actor: AdminIdentity | null
  action: string
  targetKind?: string | null
  targetId?: string | null
  payload?: Record<string, unknown>
}) {
  try {
    const sb = getServiceClient()
    await sb.from('admin_audit_log').insert({
      actor_id: opts.actor?.userId ?? null,
      actor_email: opts.actor?.email ?? null,
      action: opts.action,
      target_kind: opts.targetKind ?? null,
      target_id: opts.targetId ?? null,
      payload: opts.payload ?? {},
    })
  } catch (err) {
    console.error('[v0] admin audit write failed:', err)
  }
}
