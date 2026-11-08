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
import { SIGNED_OUT_USER, cachedIdentity, watchIdentity, type ChromeUser } from './chrome-identity'

export type ActiveRail =
  | 'projects' | 'chats' | 'history' | 'gallery'
  // Surfaces opened from the avatar dropdown (no rail-nav highlight).
  | 'skills' | 'settings' | 'admin'

export type { ChromeUser }

const DEFAULT_USER: ChromeUser = SIGNED_OUT_USER

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

  /* ---------- profile (rail footer + topstrip identity) ----------
   *
   * Loaded on mount AND re-fetched whenever any surface dispatches
   * `clox-profile-changed`. /settings dispatches it immediately
   * after a successful profile save / avatar regenerate; without
   * this listener the user-menu chip and the rail avatar stay
   * stale until a full page reload, even though /settings itself
   * shows the new values. A `clox.profile.tick` localStorage
   * sentinel on cross-tab `storage` events keeps multiple open
   * tabs in lockstep too. */
  // Starts from the identity the previous page already loaded, so the rail
  // footer doesn't flash "Signed out" on every click.
  const [user, setUser] = useState<ChromeUser>(() => cachedIdentity()?.user ?? DEFAULT_USER)
  const [isSuperAdmin, setIsSuperAdmin] = useState(() => cachedIdentity()?.isSuperAdmin ?? false)
  useEffect(() => watchIdentity(identity => {
    setUser(identity.user)
    setIsSuperAdmin(identity.isSuperAdmin)
  }), [])

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
    onOpenSuperAdmin:  isSuperAdmin ? () => router.push('/admin') : undefined,
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
