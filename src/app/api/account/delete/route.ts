import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/account/delete
 *
 * Soft-deletes the caller's profile row and signs them out. Permanent auth-
 * level deletion needs a service-role key — which we don't expose at runtime
 * by default — so we mark the profile as deleted and let an admin/cron
 * finish the cleanup. If no `profiles` table exists yet we still return 200
 * so the UI sign-out flow proceeds.
 */
export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: getUserError } = await supabase.auth.getUser()
  if (getUserError || !user) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  // Best-effort: mark profile deleted. We swallow "table not found" errors so
  // the route still works on barebones installations.
  try {
    await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', user.id)
  } catch {
    /* table may not exist; sign-out alone is acceptable */
  }

  await supabase.auth.signOut()

  return NextResponse.json({ ok: true })
}
