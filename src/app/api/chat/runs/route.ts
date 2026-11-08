import { getCallerForLogging } from '@/lib/projects/usage'
import { latestRun } from '@/lib/chat-runs'

export const dynamic = 'force-dynamic'

/** GET /api/chat/runs?chatId= — the newest reply being (or just) generated for a chat. */
export async function GET(req: Request) {
  const chatId = new URL(req.url).searchParams.get('chatId')
  if (!chatId) return Response.json({ run: null })
  const caller = await getCallerForLogging()
  if (!caller) return Response.json({ run: null }, { status: 401 })
  const run = await latestRun(caller.userId, chatId)
  return Response.json({ run }, { headers: { 'Cache-Control': 'no-store' } })
}
