import { NextResponse } from 'next/server'
import { requireUser, logActivity } from '@/lib/projects/server'

/**
 * PATCH  /api/chats/[id]   — update title, model, project_id (move between projects)
 * DELETE /api/chats/[id]   — soft archive (or hard delete with ?hard=1)
 *
 * Linking a chat to a project triggers a project_activity 'chat.added' event.
 * Unlinking → 'chat.removed'.
 */

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, supabase } = await requireUser()
    const body = await req.json().catch(() => ({}))

    const { data: existing } = await supabase
      .from('chats')
      .select('id, owner_id, project_id, title, modality')
      .eq('id', id)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.title !== undefined) update.title = String(body.title).trim() || existing.title
    if (body.model !== undefined) update.model = body.model ? String(body.model) : null

    const wantsProject = Object.prototype.hasOwnProperty.call(body, 'project_id')
    const newProjectId = wantsProject
      ? (body.project_id ? String(body.project_id) : null)
      : existing.project_id

    if (wantsProject && newProjectId !== existing.project_id) {
      // If moving INTO a project, RLS requires we're a member; check upfront
      // for a clearer error.
      if (newProjectId) {
        const { data: member } = await supabase
          .from('project_members')
          .select('id')
          .eq('project_id', newProjectId)
          .eq('user_id', user.id)
          .maybeSingle()
        if (!member) {
          return NextResponse.json({ error: "You're not a member of that project." }, { status: 403 })
        }
      }
      update.project_id = newProjectId
    }

    const { data, error } = await supabase
      .from('chats')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error

    if (wantsProject && newProjectId !== existing.project_id) {
      if (existing.project_id) {
        await logActivity({
          projectId: existing.project_id,
          actorId: user.id,
          actorEmail: user.email ?? null,
          action: 'chat.removed',
          targetKind: 'chat',
          targetId: id,
          payload: { title: existing.title, modality: existing.modality },
        })
      }
      if (newProjectId) {
        await logActivity({
          projectId: newProjectId,
          actorId: user.id,
          actorEmail: user.email ?? null,
          action: 'chat.added',
          targetKind: 'chat',
          targetId: id,
          payload: { title: data.title, modality: data.modality },
        })
      }
    }

    return NextResponse.json({ chat: data })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(req.url)
    const { supabase } = await requireUser()

    if (url.searchParams.get('hard') === '1') {
      const { error } = await supabase.from('chats').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true, deleted: 'hard' })
    }

    const { error } = await supabase
      .from('chats')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true, deleted: 'archived' })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
