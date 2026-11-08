import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/projects/server'
import { signChatOutput } from '@/lib/storage/chat-outputs'

/**
 * GET /api/files/<userId>/<chatId>/<file>[?download=1]
 *
 * Permanent link to a file the user created. Chats keep this link instead of
 * a signed storage URL (those die after an hour), and each request mints a
 * fresh short-lived one. Only the owner of the folder can open it.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  let userId: string
  try {
    userId = (await requireUser()).user.id
  } catch {
    return NextResponse.json({ error: 'Sign in to open this file' }, { status: 401 })
  }
  const parts = path.map(p => decodeURIComponent(p))
  if (parts.length < 2 || parts[0] !== userId || parts.some(p => p === '..' || p === '' || p.includes('/'))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const download = new URL(req.url).searchParams.get('download') === '1'
  const signed = await signChatOutput(parts.join('/'), download ? parts[parts.length - 1] : undefined)
  if (!signed) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.redirect(signed, {
    status: 302,
    headers: { 'Cache-Control': 'private, max-age=1800' },
  })
}
