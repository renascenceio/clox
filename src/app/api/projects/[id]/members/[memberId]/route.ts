import { NextResponse } from 'next/server'
import { assertProjectAdmin, getProjectForViewer, logActivity } from '@/lib/projects/server'

/**
 * PATCH  /api/projects/[id]/members/[memberId]  — change role / credit_limit_usd
 * DELETE /api/projects/[id]/members/[memberId]  — remove (or self-leave)
 *
 * The owner can never be removed or have their role changed; it's tied to
 * the project itself.
 */

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const { id, memberId } = await params
    const ctx = await assertProjectAdmin(id)
    const body = await req.json().catch(() => ({}))

    const { data: target } = await ctx.supabase
      .from('project_members')
      .select('id, role, email')
      .eq('id', memberId)
      .eq('project_id', id)
      .maybeSingle()
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (target.role === 'owner') {
      return NextResponse.json({ error: "The owner's role can't be changed." }, { status: 400 })
    }

    const update: Record<string, unknown> = {}
    if (body.role && ['admin','member'].includes(body.role)) update.role = body.role
    if (body.credit_limit_usd !== undefined) {
      update.credit_limit_usd = body.credit_limit_usd === null ? null : Number(body.credit_limit_usd)
    }
    if (!Object.keys(update).length) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 })
    }

    const { data: row, error } = await ctx.supabase
      .from('project_members')
      .update(update)
      .eq('id', memberId)
      .select('*')
      .single()
    if (error) throw error

    await logActivity({
      projectId: id,
      actorId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      action: 'member.updated',
      targetKind: 'member',
      targetId: memberId,
      payload: { email: target.email, ...update },
    })

    return NextResponse.json({ member: row })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const { id, memberId } = await params
    const viewer = await getProjectForViewer(id)
    const supabase = viewer.supabase

    const { data: target } = await supabase
      .from('project_members')
      .select('id, user_id, email, role')
      .eq('id', memberId)
      .eq('project_id', id)
      .maybeSingle()
    if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    if (target.role === 'owner') {
      return NextResponse.json({ error: "The owner can't be removed. Archive the project instead." }, { status: 400 })
    }

    const isSelfLeave = target.user_id === viewer.user.id
    const isAdmin = viewer.member?.role === 'owner' || viewer.member?.role === 'admin'

    if (!isSelfLeave && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase.from('project_members').delete().eq('id', memberId)
    if (error) throw error

    await logActivity({
      projectId: id,
      actorId: viewer.user.id,
      actorEmail: viewer.user.email ?? null,
      action: isSelfLeave ? 'member.left' : 'member.removed',
      targetKind: 'member',
      targetId: memberId,
      payload: { email: target.email },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
