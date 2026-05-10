/**
 * Shared rail/topstrip wiring for surfaces that don't have their own chat
 * composer (history, gallery, skills, settings, etc.). Returns everything you
 * need to spread onto a `<ChatWorkspace bodySlot=...>` instance — palette
 * state, language state, the avatar-dropdown handlers, the right `nav` array
 * for the active surface, and the live profile (name + initial + plan).
 *
 * Surfaces with a real composer (text/image/audio/video) wire most of this by
 * hand because they also own model + transcript state — but they should still
 * pull `user`, `language`, and the dropdown handlers from this hook so every
 * surface stays in sync.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { I } from './icons'
import {
  getStoredPalette,
  setStoredPalette,
  type PaletteKey,
} from './palettes'
import type { AppLanguage, RailNavItem } from './ChatWorkspace'
import { createClient } from '@/lib/supabase/client'

export type ActiveRail =
  | 'projects' | 'chats' | 'history' | 'gallery'
  // Surfaces opened from the avatar dropdown (no rail-nav highlight).
  | 'skills' | 'settings' | 'admin'

export interface ChromeUser {
  initial: string
  name: string
  plan: string
  email?: string
  avatarSeed?: string
}

const DEFAULT_USER: ChromeUser = {
  initial: '·',
  name: 'Signed out',
  plan: 'guest',
}

export function useChatChrome(active: ActiveRail) {
  const router = useRouter()

  /* ---------- theme ----------
     The pre-paint script in `layout.tsx` already applied the right
     attributes to <html> before render, so this effect only needs to
     mirror the stored value into local React state. `setStoredPalette`
     is the single owner of every DOM mutation (data-theme, data-palette,
     .dark class, localStorage), so we never end up with the React state,
     CSS variables, and inline palette out of sync.
  */
  const [theme, setTheme] = useState<PaletteKey>('pearl')
  useEffect(() => {
    const stored = getStoredPalette('pearl')
    setTheme(stored)
  }, [])
  function handleThemeChange(next: PaletteKey) {
    setTheme(next)
    setStoredPalette(next)
  }

  /* ---------- language ---------- */
  const [language, setLanguage] = useState<AppLanguage>('en')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('clox.language') as AppLanguage | null
    if (stored === 'en' || stored === 'ru') setLanguage(stored)
  }, [])
  function handleChangeLanguage(next: AppLanguage) {
    setLanguage(next)
    if (typeof window !== 'undefined') localStorage.setItem('clox.language', next)
  }

  /* ---------- profile (rail footer + topstrip identity) ---------- */
  const [user, setUser] = useState<ChromeUser>(DEFAULT_USER)
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser || cancelled) return

        const [profile, credits] = await Promise.all([
          supabase
            .from('profiles')
            .select('first_name, last_name, plan, avatar_seed')
            .eq('id', authUser.id)
            .single(),
          supabase
            .from('credits')
            .select('balance_usd')
            .eq('user_id', authUser.id)
            .single(),
        ])

        if (cancelled) return

        const first = (profile.data?.first_name ?? '').trim()
        const last  = (profile.data?.last_name  ?? '').trim()
        const fullName = [first, last].filter(Boolean).join(' ').trim()
        const fallbackName = authUser.email?.split('@')[0] ?? 'Clox user'
        const name = fullName || fallbackName

        const initial = (first || fallbackName).slice(0, 1).toLowerCase() || '·'

        // Plan label is intentionally compact (matches "pro · 4 seats" cadence
        // used in the design reference). Falls back to the credit balance so
        // even a free account shows something meaningful in the rail footer.
        const planRaw = (profile.data?.plan as string | null | undefined)?.toLowerCase()
        let plan: string
        if (planRaw && planRaw !== 'free') {
          plan = planRaw
        } else if (credits.data?.balance_usd != null) {
          const balance = parseFloat(String(credits.data.balance_usd))
          plan = `free · $${balance.toFixed(2)}`
        } else {
          plan = 'free'
        }

        setUser({
          initial,
          name,
          plan,
          email: authUser.email ?? undefined,
          avatarSeed: profile.data?.avatar_seed ?? authUser.email ?? undefined,
        })
      } catch (e) {
        console.error('[v0] useChatChrome profile load failed', e)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  /* ---------- account actions (avatar dropdown) ---------- */
  async function handleSignOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (e) {
      console.error('[v0] sign-out error:', e)
    }
    if (typeof window !== 'undefined') window.location.href = '/login'
  }
  async function handleDeleteAccount() {
    const ok = typeof window !== 'undefined'
      && window.confirm('Permanently delete your Clox account? This cannot be undone.')
    if (!ok) return
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) throw new Error(`delete failed: ${res.status}`)
    } catch (e) {
      console.error('[v0] delete-account error:', e)
      window.alert('We could not delete your account. Please contact support.')
      return
    }
    await handleSignOut()
  }

  /* ---------- rail nav (no Home — chat is the entry point) ---------- */
  const nav: RailNavItem[] = [
    { id: 'projects', label: 'Projects', icon: I.proj,  onClick: () => router.push('/projects'), active: active === 'projects' },
    { id: 'chats',    label: 'Chats',    icon: I.chats, onClick: () => router.push('/text'),     active: active === 'chats' },
    { id: 'history',  label: 'History',  icon: I.hist,  onClick: () => router.push('/history'),  active: active === 'history' },
    { id: 'gallery',  label: 'Gallery',  icon: I.gal,   onClick: () => router.push('/gallery'),  active: active === 'gallery' },
  ]

  return {
    router,
    theme,
    language,
    user,
    handleThemeChange,
    handleChangeLanguage,
    handleSignOut,
    handleDeleteAccount,
    nav,
    onOpenSettings:    () => router.push('/settings'),
    onOpenSuperAdmin:  () => router.push('/admin'),
    onOpenSkills:      () => router.push('/skills'),
    onNewChat:         () => router.push('/text'),
    // The "see all →" affordance in the rail's recent block. Defaults to
    // /history (the chats list) — every chrome-driven surface (history,
    // gallery, skills, settings, projects, project-detail) gets a working
    // button by passing this through to ChatWorkspace. The /text composer
    // wires its own version directly because it doesn't use this hook.
    onSeeAllRecent:    () => router.push('/history'),
  }
}
