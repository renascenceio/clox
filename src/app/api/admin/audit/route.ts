import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull } from '@/lib/admin/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/audit?limit=200&action=flag.update&actor=<email>
 * Newest first, capped at 500 per request.
 */
export async function GET(req: Request) {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? '200')))
  const actionFilter = url.searchParams.get('action')
  const actorFilter = url.searchParams.get('actor')

  const sb = getServiceClient()
  let q = sb.from('admin_audit_log')
    .select('id, actor_id, actor_email, action, target_kind, target_id, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (actionFilter) q = q.eq('action', actionFilter)
  if (actorFilter) q = q.ilike('actor_email', `%${actorFilter}%`)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: data ?? [] })
}
