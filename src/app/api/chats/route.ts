import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/projects/server'

/**
 * GET  /api/chats         — chats the caller can see (own + project memberships)
 * POST /api/chats         — create a new chat metadata row, optionally bound to a project
 *
 * The localStorage chat-store is still where messages live (see lib/chat-store).
 * The DB row is metadata only: title, modality, model, project_id.
 */

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { supabase } = await requireUser()
    const url = new URL(req.url)
    const projectId = url.searchParams.get('project_id')

    let q = supabase
      .from('chats')
      .select('id, owner_id, project_id, modality, title, model, archived_at, created_at, updated_at')
      .order('archived_at', { ascending: true, nullsFirst: true })
      .order('updated_at', { ascending: false })
    if (projectId) q = q.eq('project_id', projectId)

    const { data, error } = await q
    if (error) throw error
    return NextResponse.json({ chats: data ?? [] })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await requireUser()
    const body = await req.json().catch(() => ({}))
    const title = (body.title ?? 'Untitled').toString().trim() || 'Untitled'
    const modality = ['text','image','video','audio','research','code'].includes(body.modality)
      ? body.modality : 'text'
    const model = body.model ? String(body.model) : null
    const projectId = body.project_id ? String(body.project_id) : null

    const { data, error } = await supabase
      .from('chats')
      .insert({
        owner_id: user.id,
        project_id: projectId,
        modality,
        title,
        model,
      })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ chat: data }, { status: 201 })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
