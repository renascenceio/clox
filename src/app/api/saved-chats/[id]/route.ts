import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/projects/server'

/**
 * GET    /api/saved-chats/:id   — one chat with its messages / generations
 * PUT    /api/saved-chats/:id   — save { modality, record?, history?, deleted? }
 * DELETE /api/saved-chats/:id   — forget it for good
 *
 * Rows are scoped to the caller by RLS (user_id = auth.uid()).
 */
export const dynamic = 'force-dynamic'

const MODALITIES = new Set(['text', 'image', 'video', 'audio'])
const MAX_HISTORY_BYTES = 4_000_000

function fail(err: unknown) {
  const e = err as Error & { status?: number }
  return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
}

function validId(id: string) {
  return /^[\w-]{1,120}$/.test(id)
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { supabase } = await requireUser()
    const { data, error } = await supabase
      .from('saved_chats')
      .select('chat_id, modality, record, history, deleted_at, updated_at')
      .eq('chat_id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      chatId: data.chat_id,
      modality: data.modality,
      record: data.record,
      history: data.history ?? [],
      deletedAt: data.deleted_at,
      updatedAt: data.updated_at,
    })
  } catch (err) {
    return fail(err)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!validId(id)) return NextResponse.json({ error: 'Bad chat id' }, { status: 400 })
    const { user, supabase } = await requireUser()
    const raw = await req.text()
    if (raw.length > MAX_HISTORY_BYTES + 200_000) {
      return NextResponse.json({ error: 'Chat is too large to save' }, { status: 413 })
    }
    const body = JSON.parse(raw || '{}') as {
      modality?: string
      record?: Record<string, unknown>
      history?: unknown[]
      deleted?: boolean
    }
    const row: Record<string, unknown> = {
      user_id: user.id,
      chat_id: id,
      updated_at: new Date().toISOString(),
    }
    if (body.modality && MODALITIES.has(body.modality)) row.modality = body.modality
    if (body.record && typeof body.record === 'object') row.record = body.record
    if (Array.isArray(body.history)) {
      const json = JSON.stringify(body.history)
      if (json.length > MAX_HISTORY_BYTES) {
        return NextResponse.json({ error: 'Chat is too large to save' }, { status: 413 })
      }
      row.history = body.history
      row.history_bytes = json.length
    }
    if (typeof body.deleted === 'boolean') row.deleted_at = body.deleted ? new Date().toISOString() : null

    const { error } = await supabase.from('saved_chats').upsert(row, { onConflict: 'user_id,chat_id' })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return fail(err)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { supabase } = await requireUser()
    const { error } = await supabase.from('saved_chats').delete().eq('chat_id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return fail(err)
  }
}
