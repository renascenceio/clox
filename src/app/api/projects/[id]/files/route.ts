import { NextResponse } from 'next/server'
import { getProjectForViewer, assertProjectAdmin, logActivity } from '@/lib/projects/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await getProjectForViewer(id)
    const { data, error } = await ctx.supabase
      .from('project_files')
      .select('id, name, content_type, size_bytes, blob_url, created_at, uploaded_by')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return NextResponse.json({ files: data ?? [] })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const ctx = await assertProjectAdmin(id)
    const body = await req.json().catch(() => ({}))
    const name = String(body.name ?? '').trim()
    const blob_url = String(body.blob_url ?? '').trim()
    const content_type = body.content_type ? String(body.content_type) : null
    const size_bytes = Math.max(0, Number(body.size_bytes ?? 0))
    const extracted_text = body.extracted_text ? String(body.extracted_text) : null
    if (!name || !blob_url) {
      return NextResponse.json({ error: 'name and blob_url are required' }, { status: 400 })
    }

    const { data, error } = await ctx.supabase
      .from('project_files')
      .insert({
        project_id: id,
        uploaded_by: ctx.user.id,
        name, blob_url, content_type, size_bytes, extracted_text,
      })
      .select('*')
      .single()
    if (error) throw error

    await logActivity({
      projectId: id,
      actorId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      action: 'file.uploaded',
      targetKind: 'file',
      targetId: data.id,
      payload: { name, size_bytes, content_type },
    })
    return NextResponse.json({ file: data }, { status: 201 })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
