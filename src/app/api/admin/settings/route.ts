import { NextResponse } from 'next/server'
import { getServiceClient, getSuperAdminOrNull, writeAudit } from '@/lib/admin/server'

export const dynamic = 'force-dynamic'

/** GET /api/admin/settings — every key/value row. */
export async function GET() {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const sb = getServiceClient()
  const { data, error } = await sb
    .from('admin_platform_settings')
    .select('key, value, updated_at')
    .order('key', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reshape into a keyed object so the UI can do `settings.site.name`.
  const out: Record<string, unknown> = {}
  for (const row of data ?? []) out[row.key] = row.value
  return NextResponse.json({ settings: out })
}

/** PATCH /api/admin/settings — body: { key, value } (full replace). */
export async function PATCH(req: Request) {
  const actor = await getSuperAdminOrNull()
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: { key?: string; value?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }) }
  if (!body.key || typeof body.key !== 'string') {
    return NextResponse.json({ error: 'key_required' }, { status: 400 })
  }

  const sb = getServiceClient()
  const { data, error } = await sb
    .from('admin_platform_settings')
    .upsert({
      key: body.key,
      value: body.value ?? {},
      updated_by: actor.userId,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAudit({
    actor,
    action: 'setting.update',
    targetKind: 'setting',
    targetId: body.key,
    payload: { value: body.value },
  })

  return NextResponse.json({ setting: data })
}
