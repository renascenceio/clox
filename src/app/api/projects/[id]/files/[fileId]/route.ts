import { NextResponse } from 'next/server'
import { assertProjectAdmin, logActivity } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const { id, fileId } = await params
    const ctx = await assertProjectAdmin(id)
    const { data: target } = await ctx.supabase
      .from('project_files')
      .select('id, name')
      .eq('id', fileId)
      .eq('project_id', id)
      .maybeSingle()
    if (!target) return NextResponse.json({ error: 'File not found' }, { status: 404 })

    const { error } = await ctx.supabase.from('project_files').delete().eq('id', fileId)
    if (error) throw error

    await logActivity({
      projectId: id,
      actorId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      action: 'file.removed',
      targetKind: 'file',
      targetId: fileId,
      payload: { name: target.name },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
