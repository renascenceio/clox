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
    // Optional explicit id — used when promoting a localStorage chat into the
    // DB so the metadata row keeps the same id as the local message store.
    // Must be a valid UUID; if not, we silently let Postgres generate one.
    const requestedId = typeof body.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)
      ? body.id : null

    // If a chat with this id already exists and the caller owns it, treat the
    // POST as idempotent: just patch the project_id / title and return.
    if (requestedId) {
      const { data: existing } = await supabase
        .from('chats')
        .select('id, owner_id, project_id, title')
        .eq('id', requestedId)
        .maybeSingle()
      if (existing) {
        if (existing.owner_id !== user.id) {
          return NextResponse.json({ error: 'Chat id already taken.' }, { status: 409 })
        }
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (projectId !== existing.project_id) update.project_id = projectId
        if (title && title !== existing.title) update.title = title
        const { data: patched, error: patchErr } = await supabase
          .from('chats')
          .update(update)
          .eq('id', requestedId)
          .select('*')
          .single()
        if (patchErr) throw patchErr
        return NextResponse.json({ chat: patched }, { status: 200 })
      }
    }

    const insertable: Record<string, unknown> = {
      owner_id: user.id,
      project_id: projectId,
      modality,
      title,
      model,
    }
    if (requestedId) insertable.id = requestedId

    const { data, error } = await supabase
      .from('chats')
      .insert(insertable)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ chat: data }, { status: 201 })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
