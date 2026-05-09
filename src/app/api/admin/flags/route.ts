import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull, writeAudit } from '@/lib/admin/server'

export const dynamic = 'force-dynamic'

/** GET /api/admin/flags — list every feature flag, oldest key first. */
export async function GET() {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('admin_feature_flags')
    .select('key, description, enabled, rollout_pct, updated_at')
    .order('key', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flags: data ?? [] })
}

/** PATCH /api/admin/flags — body: { key, enabled?, rollout_pct? }. */
export async function PATCH(req: Request) {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: { key?: string; enabled?: boolean; rollout_pct?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }

  const key = body.key
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key_required' }, { status: 400 })
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: actor.userId }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled
  if (typeof body.rollout_pct === 'number') {
    patch.rollout_pct = Math.min(100, Math.max(0, Math.round(body.rollout_pct)))
  }

  const sb = getServiceClient()
  const { data, error } = await sb
    .from('admin_feature_flags')
    .update(patch)
    .eq('key', key)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAudit({
    actor,
    action: 'flag.update',
    targetKind: 'flag',
    targetId: key,
    payload: patch,
  })

  return NextResponse.json({ flag: data })
}
