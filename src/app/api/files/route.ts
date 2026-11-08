import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/projects/server'
import { deleteChatOutput } from '@/lib/storage/chat-outputs'
import { fileUrl } from '@/lib/storage/file-url'

/**
 * GET    /api/files            — every file the caller created, newest first
 *        ?chatId=…             — only one chat's files
 * DELETE /api/files {path}     — remove one of them
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { supabase } = await requireUser()
    const chatId = new URL(req.url).searchParams.get('chatId')
    let query = supabase
      .from('chat_files')
      .select('path, chat_id, filename, mime, size, created_at, updated_at')
    if (chatId) query = query.eq('chat_id', chatId)
    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(chatId ? 200 : 1000)
    if (error) throw error
    return NextResponse.json({
      files: (data ?? []).map(f => ({
        path: f.path,
        chatId: f.chat_id,
        filename: f.filename,
        mime: f.mime,
        size: Number(f.size) || 0,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
        url: fileUrl(f.path),
      })),
    })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { user } = await requireUser()
    const { path } = (await req.json().catch(() => ({}))) as { path?: unknown }
    if (typeof path !== 'string' || !path) return NextResponse.json({ error: 'path is required' }, { status: 400 })
    await deleteChatOutput(user.id, path)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const e = err as Error & { status?: number }
    return NextResponse.json({ error: e.message }, { status: e.status ?? (e.message === 'Not your file' ? 403 : 500) })
  }
}
