import { NextResponse } from 'next/server'
import { assertProjectAdmin, logActivity } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; inviteId: string }> }) {
  try {
    const { id, inviteId } = await params
    const ctx = await assertProjectAdmin(id)
    const { data: target } = await ctx.supabase
      .from('project_invites')
      .select('id, email')
      .eq('id', inviteId)
      .eq('project_id', id)
      .maybeSingle()
    if (!target) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

    const { error } = await ctx.supabase.from('project_invites').delete().eq('id', inviteId)
    if (error) throw error

    await logActivity({
      projectId: id,
      actorId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      action: 'invite.revoked',
      targetKind: 'invite',
      targetId: inviteId,
      payload: { email: target.email },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
