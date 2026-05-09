/**
 * Shared rail/topstrip wiring for surfaces that don't have their own chat
 * composer (history, gallery, skills, etc.). Returns everything you need to
 * spread onto a `<ChatWorkspace bodySlot=...>` instance — palette state,
 * language state, the avatar-dropdown handlers and the right `nav` array
 * for the active surface.
 *
 * Surfaces with a real composer (text/image/audio/video) wire these by hand
 * because they also own the model + transcript state.
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
  | 'home' | 'projects' | 'chats' | 'history' | 'gallery'
  // Surfaces opened from the avatar dropdown (no rail-nav highlight).
  | 'skills' | 'settings' | 'admin'

export function useChatChrome(active: ActiveRail) {
  const router = useRouter()

  // Theme
  const [theme, setTheme] = useState<PaletteKey>('pearl')
  useEffect(() => {
    const stored = getStoredPalette('pearl')
    setTheme(stored)
    document.documentElement.dataset.palette = stored
  }, [])
  function handleThemeChange(next: PaletteKey) {
    setTheme(next)
    setStoredPalette(next)
  }

  // Language
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

  // Sign-out + delete-account
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

  const nav: RailNavItem[] = [
    { id: 'home',     label: 'Home',     icon: I.home,  onClick: () => router.push('/'),        active: active === 'home' },
    { id: 'projects', label: 'Projects', icon: I.proj,  count: 0,                              active: active === 'projects' },
    { id: 'chats',    label: 'Chats',    icon: I.chats, onClick: () => router.push('/text'),    active: active === 'chats' },
    { id: 'history',  label: 'History',  icon: I.hist,  onClick: () => router.push('/history'), active: active === 'history' },
    { id: 'gallery',  label: 'Gallery',  icon: I.gal,   onClick: () => router.push('/gallery'), active: active === 'gallery' },
  ]

  return {
    router,
    theme,
    language,
    handleThemeChange,
    handleChangeLanguage,
    handleSignOut,
    handleDeleteAccount,
    nav,
    onOpenSettings:    () => router.push('/settings'),
    onOpenSuperAdmin:  () => router.push('/admin'),
    onOpenSkills:      () => router.push('/skills'),
    onNewChat:         () => router.push('/text'),
  }
}
