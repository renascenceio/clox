import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull, writeAudit } from '@/lib/admin/server'
import { PLANS, planFor } from '@/lib/plans'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = new Set(['user', 'super_admin'])

/**
 * PATCH /api/admin/users/[id] — body: { role?, plan? }
 * Only super_admins may demote/promote. We refuse to demote the last admin
 * so the platform can never be locked out.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await ctx.params
  let body: { role?: string; plan?: string; addCredits?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const sb = getServiceClient()

  // Plans and credits are set by hand until payments are connected.
  if (body.plan || body.addCredits) {
    if (body.plan) {
      if (!(body.plan in PLANS)) return NextResponse.json({ error: 'bad_plan' }, { status: 400 })
      const plan = planFor(body.plan)
      const { error } = await sb.from('profiles').update({ plan: plan.id, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const next = new Date()
      next.setUTCMonth(next.getUTCMonth() + 1)
      await sb.rpc('renew_credits', { p_user_id: id, p_grant: plan.credits, p_period_end: next.toISOString(), p_change: true })
    }
    const add = Number(body.addCredits ?? 0)
    if (add) {
      if (!Number.isFinite(add) || add < 0 || add > 1_000_000) return NextResponse.json({ error: 'bad_amount' }, { status: 400 })
      await sb.rpc('add_topup_credits', { p_user_id: id, p_amount: add })
    }
    const { data: credit } = await sb.from('credits').select('balance_credits').eq('user_id', id).maybeSingle()
    await writeAudit({
      actor,
      action: body.plan ? 'user.plan_change' : 'user.credits_added',
      targetKind: 'user',
      targetId: id,
      payload: { plan: body.plan ?? null, addCredits: add || null },
    })
    return NextResponse.json({ plan: body.plan ?? null, balance_credits: Number(credit?.balance_credits ?? 0) })
  }

  // If demoting an admin, count the remaining admins first.
  if (body.role && body.role !== 'super_admin') {
    const { data: currentRow } = await sb.from('profiles').select('role').eq('id', id).single()
    if (currentRow?.role === 'super_admin') {
      const { count } = await sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'super_admin')
      if ((count ?? 0) <= 1) {
        return NextResponse.json({ error: 'last_admin' }, { status: 409 })
      }
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.role) {
    if (!ALLOWED_ROLES.has(body.role)) {
      return NextResponse.json({ error: 'bad_role' }, { status: 400 })
    }
    patch.role = body.role
  }

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  const { data, error } = await sb.from('profiles').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAudit({
    actor,
    action: body.role ? 'user.role_change' : 'user.update',
    targetKind: 'user',
    targetId: id,
    payload: patch,
  })
  return NextResponse.json({ user: data })
}
