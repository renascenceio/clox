'use client'

import { createClient } from '@/lib/supabase/client'
import { formatCredits, planFor } from '@/lib/plans'

export interface ChromeUser {
  initial: string
  name: string
  plan: string
  email?: string
  avatarSeed?: string
}

export interface ChromeIdentity {
  user: ChromeUser
  isSuperAdmin: boolean
}

export const SIGNED_OUT_USER: ChromeUser = { initial: '·', name: 'Signed out', plan: 'guest' }

/* Every page mounts its own shell, so without a shared copy each click
   re-asked Supabase who you are and drew "Signed out" until it answered.
   The module copy lives for the whole client session; pages start from it
   and refresh it quietly. */
let cached: ChromeIdentity | null = null
let inflight: Promise<ChromeIdentity | null> | null = null

export function cachedIdentity(): ChromeIdentity | null {
  return cached
}

export function loadIdentity(force = false): Promise<ChromeIdentity | null> {
  if (inflight && !force) return inflight
  const run = (async () => {
    const supabase = createClient()
    // getSession reads the local session; the database calls below are
    // still checked by row-level security.
    const { data: { session } } = await supabase.auth.getSession()
    const authUser = session?.user
    if (!authUser) { cached = null; return null }

    const [profile, credits] = await Promise.all([
      supabase.from('profiles').select('first_name, last_name, plan, avatar_seed, role').eq('id', authUser.id).single(),
      supabase.from('credits').select('balance_credits').eq('user_id', authUser.id).single(),
    ])

    const first = (profile.data?.first_name ?? '').trim()
    const last = (profile.data?.last_name ?? '').trim()
    const fallback = authUser.email?.split('@')[0] ?? 'Omma user'
    const name = [first, last].filter(Boolean).join(' ').trim() || fallback
    const planName = planFor(profile.data?.plan as string | null | undefined).name.toLowerCase()

    cached = {
      isSuperAdmin: profile.data?.role === 'super_admin',
      user: {
        initial: (first || fallback).slice(0, 1).toLowerCase() || '·',
        name,
        plan: credits.data?.balance_credits != null
          ? `${planName} · ${formatCredits(Number(credits.data.balance_credits))} credits`
          : planName,
        email: authUser.email ?? undefined,
        avatarSeed: profile.data?.avatar_seed ?? authUser.email ?? undefined,
      },
    }
    return cached
  })()
  inflight = run
  run.finally(() => { if (inflight === run) inflight = null }).catch(() => {})
  return run
}

/** Calls `onChange` with fresh identity on mount and whenever settings
 *  (this tab or another) say the profile changed. */
export function watchIdentity(onChange: (identity: ChromeIdentity) => void): () => void {
  let live = true
  const refresh = (force: boolean) => {
    loadIdentity(force)
      .then(identity => { if (live && identity) onChange(identity) })
      .catch(e => console.error('[clox] profile load failed', e))
  }
  refresh(false)
  const onProfileChanged = () => refresh(true)
  const onStorage = (e: StorageEvent) => { if (e.key === 'clox.profile.tick') refresh(true) }
  window.addEventListener('clox-profile-changed', onProfileChanged)
  window.addEventListener('storage', onStorage)
  return () => {
    live = false
    window.removeEventListener('clox-profile-changed', onProfileChanged)
    window.removeEventListener('storage', onStorage)
  }
}
