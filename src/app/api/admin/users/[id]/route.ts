import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull, writeAudit } from '@/lib/admin/server'

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
  let body: { role?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const sb = getServiceClient()

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
