import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/projects/server'

/**
 * GET /api/saved-chats — the caller's chats as saved on the server (sidebar
 * records only, no messages), so another device can list them.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { user, supabase } = await requireUser()
    const { data, error } = await supabase
      .from('saved_chats')
      .select('chat_id, modality, record, history_bytes, deleted_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(2000)
    if (error) throw error
    return NextResponse.json({
      userId: user.id,
      chats: (data ?? []).map(r => ({
        chatId: r.chat_id,
        modality: r.modality,
        record: r.record,
        hasHistory: (r.history_bytes ?? 0) > 0,
        deletedAt: r.deleted_at,
        updatedAt: r.updated_at,
      })),
    })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}
