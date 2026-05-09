'use client'

/*
 * Editorial × productivity shell — Anthology / Pearl & Onyx.
 * Keeps the existing surface contract (children + sidebar + optional rightPanel)
 * so every page that already uses AppLayout cascades into the new design with
 * zero refactor. The shell itself contributes:
 *
 *   • a 248px left rail   — brand wordmark, ⌘K search row, primary nav with
 *                            an active 2px accent bar, the (caller-supplied)
 *                            recent thread list, user footer
 *   • a main column        — borderless, the page draws its own top strip
 *   • an optional right    — sharp hairline panel for project/config drawers
 *
 * No shadows, no gradients, no glass. Hairline-only structure.
 */

import { Transition, Variants } from 'framer-motion'
import { ReactNode, useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import ThemeToggle from '@/shared/ui/components/ThemeToggle'
import LanguageSwitcher from '@/shared/ui/components/LanguageSwitcher'
import Avatar from '@/shared/ui/components/Avatar'
import { createClient } from '@/lib/supabase/client'
import { syncLocalChatsToDB } from '@/lib/projects/chat-sync'

export const spring: Transition = { type: "spring", stiffness: 380, damping: 30 }

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.16 } }
}

export const stagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05 } }
}

export const cardVariant: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28 } }
}

interface AppLayoutProps {
  children: ReactNode
  sidebar: ReactNode
  rightPanel?: ReactNode
}

interface UserProfile {
  email: string
  firstName: string
  role: string
  balance: string
  avatarSeed: string
}

/**
 * Profile cache — module-level + sessionStorage. The shell mounts once per
 * page, but the profile only changes after sign-in / sign-out. Without this
 * cache every Link click pays for two Supabase round-trips (profiles +
 * credits), which is the "long thinking pause" the user reported.
 *
 * Resolution rules:
 *   1. Read cached value synchronously on first render — UI fills immediately.
 *   2. Kick off a background refresh on the *first mount only* of this tab,
 *      then update the cache + state. Stale-while-revalidate.
 *   3. Subsequent mounts see the cache and skip the network entirely.
 */
const PROFILE_CACHE_KEY = 'clox.cache.profile.v1'
let profileMemo: UserProfile | null = null
let profileFetchedThisSession = false
let chatSyncRanThisSession = false

function readCachedProfile(): UserProfile | null {
  if (profileMemo) return profileMemo
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserProfile
    profileMemo = parsed
    return parsed
  } catch {
    return null
  }
}

function writeCachedProfile(p: UserProfile) {
  profileMemo = p
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)) } catch { /* quota — fine */ }
  }
}

/* Primary nav — there is exactly ONE chat surface (`/text`). Modality
   (text / image / video / voice) is chosen *inside* the composer via
   the slash menu, never by route or rail item. Earlier we shipped four
   rail entries that all linked into the same `/text` page with a
   `?mode=…` query, but every click felt like opening a separate page
   — visually identical to the old standalone surfaces — and that
   became a recurring source of confusion. The fix is structural: the
   rail no longer exposes per-modality entrypoints at all.

   The legacy `/image`, `/video`, `/audio` routes still exist as
   server-side redirects so any old bookmark resolves cleanly; they
   forward to `/text` (no mode param) and the user picks the modality
   from the in-composer slash menu. */
const PRIMARY_NAV: {
  href: string
  label: string
  icon: ReactNode
  count?: number | null
}[] = [
  { href: '/text',     label: 'Chat',     icon: <NavIcon path="M2 3h9v6H6L3 11.5V9H2z" /> },
  { href: '/projects', label: 'Projects', icon: <NavIcon path="M1.5 3.5h4l1 1.2h5v6.3h-10z" /> },
  { href: '/gallery',  label: 'Gallery',  icon: <NavIcon path="M1.5 2.5h10v8h-10z M1.5 8.5L4 6l2 2 2-2.5 3.5 3.5" /> },
]

function NavIcon({ path, extra }: { path: string; extra?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path d={path} stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      {extra && <path d={extra} fill="currentColor" />}
    </svg>
  )
}

export default function AppLayout({ children, sidebar, rightPanel }: AppLayoutProps) {
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)

  // Initial state is the cached profile so the rail renders fully populated
  // on first paint. We only show the empty placeholder for genuinely-new
  // visitors who haven't authenticated yet.
  const [profile, setProfile] = useState<UserProfile>(() => readCachedProfile() ?? {
    email: '',
    firstName: '',
    role: 'user',
    balance: '0.00',
    avatarSeed: '',
  })

  const loadProfile = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const email = user.email || ''
    const [profileRes, creditsRes] = await Promise.all([
      supabase.from('profiles').select('first_name, last_name, role, avatar_seed').eq('id', user.id).single(),
      supabase.from('credits').select('balance_usd').eq('user_id', user.id).single(),
    ])

    const firstName = profileRes.data?.first_name || email.split('@')[0]
    const lastName = profileRes.data?.last_name || ''
    const next: UserProfile = {
      email,
      firstName: lastName ? `${firstName} ${lastName}` : firstName,
      role: profileRes.data?.role || 'user',
      balance: creditsRes.data?.balance_usd != null
        ? parseFloat(creditsRes.data.balance_usd).toFixed(2)
        : '0.00',
      avatarSeed: profileRes.data?.avatar_seed || '',
    }
    writeCachedProfile(next)
    setProfile(next)
  }, [])

  // Refetch only once per session. Subsequent navigations read the cached
  // value synchronously, so flipping between Chat / Image / Projects /
  // Gallery feels instant.
  useEffect(() => {
    if (profileFetchedThisSession) return
    profileFetchedThisSession = true
    void loadProfile()
  }, [loadProfile])

  // One-shot localStorage→DB chat migration. Guarded with a module-level
  // flag so it runs at most once per tab regardless of how many times
  // AppLayout mounts (each route is its own React tree).
  useEffect(() => {
    if (chatSyncRanThisSession) return
    chatSyncRanThisSession = true
    const t = window.setTimeout(() => { void syncLocalChatsToDB() }, 600)
    return () => window.clearTimeout(t)
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (!showUserMenu) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-user-menu]')) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showUserMenu])

  // Open the global ⌘K palette by dispatching an event the page can listen for.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('clox-open-palette'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleSignOut = async () => {
    profileMemo = null
    profileFetchedThisSession = false
    try { window.sessionStorage.removeItem(PROFILE_CACHE_KEY) } catch { /* fine */ }
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) return
    profileMemo = null
    profileFetchedThisSession = false
    try { window.sessionStorage.removeItem(PROFILE_CACHE_KEY) } catch { /* fine */ }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').delete().eq('id', user.id)
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const isSuperAdmin = profile.role === 'super_admin'
  const isFreeDomain = ['renascence.io', 'gaiarealty.ae', 'clox.ai'].some(d => profile.email.endsWith('@' + d))

  const roleLabel =
    profile.role === 'super_admin' ? 'Emperor'
    : profile.role === 'admin' ? 'Admin'
    : profile.role === 'user' ? 'User'
    : profile.role || 'User'

  return (
    <div className="flex h-screen bg-bg text-ink overflow-hidden">

      {/* ============================================================== */}
      {/* Left rail                                                      */}
      {/* ============================================================== */}

      <aside
        className="flex-none w-[248px] flex flex-col bg-rail text-ink border-r border-hairline"
        aria-label="Workspace navigation"
      >
        {/* Brand row — wordmark + version chip + new-chat affordance */}
        <div className="flex items-center justify-between px-[18px] pt-4 pb-3">
          <Link href="/text" className="flex items-baseline gap-2 select-none">
            <span className="font-serif italic text-[19px] tracking-[-0.01em] leading-none text-ink">
              Clox
            </span>
            <span className="font-mono text-[9.5px] tracking-[0.14em] uppercase text-ink-muted">
              0.4
            </span>
          </Link>
          <button
            type="button"
            title="New chat (⌘N)"
            onClick={() => window.dispatchEvent(new CustomEvent('clox-new-chat'))}
            className="w-[26px] h-[26px] inline-flex items-center justify-center border border-hairline-soft rounded-sharp text-ink-soft hover:text-ink hover:border-hairline transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
              <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span className="sr-only">New chat</span>
          </button>
        </div>

        {/* ⌘K — search & jump */}
        <div className="px-[14px] pb-[10px]">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('clox-open-palette'))}
            className="w-full flex items-center gap-2 px-[10px] py-[7px] bg-rail-soft border border-hairline-soft rounded-sharp font-mono text-[11px] text-ink-muted hover:border-hairline transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
              <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.1" />
              <path d="m7 7 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            <span className="flex-1 text-left">search & jump</span>
            <span className="opacity-80">⌘K</span>
          </button>
        </div>

        {/* Primary nav with active 2px accent bar on the left edge */}
        <nav className="px-2 pb-2" aria-label="Primary">
          {PRIMARY_NAV.map(n => {
            const active = pathname?.startsWith(n.href) ?? false
            return (
              <Link
                key={n.label}
                href={n.href}
                className={`relative flex items-center gap-2.5 px-[10px] py-[7px] rounded-sharp text-[13px] ${
                  active
                    ? 'bg-bg text-ink font-medium'
                    : 'text-ink hover:bg-rail-soft'
                }`}
              >
                {active && <span className="absolute left-0 top-[6px] bottom-[6px] w-[2px] bg-ink" />}
                <span className={active ? 'text-ink' : 'text-ink-soft'}>{n.icon}</span>
                <span className="flex-1">{n.label}</span>
                {n.count != null && (
                  <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">{n.count}</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Recent threads — caller-supplied. We just frame it with a hairline. */}
        <div className="flex-1 min-h-0 border-t border-hairline-soft pt-1.5 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between px-[18px] pt-2.5 pb-1">
            <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">recent</span>
            <Link href="/gallery" className="font-mono text-[9.5px] tracking-[0.06em] text-ink-muted hover:text-ink">see all →</Link>
          </div>
          {sidebar}
        </div>

        {/* User footer */}
        <div className="px-[14px] py-2.5 border-t border-hairline-soft relative" data-user-menu>
          <button
            type="button"
            onClick={() => setShowUserMenu(v => !v)}
            className="w-full flex items-center gap-2.5 group"
          >
            <Avatar seed={profile.avatarSeed || undefined} size={24} className="rounded-full" />
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[12.5px] leading-tight truncate text-ink capitalize">
                {profile.firstName || '\u00a0'}
              </div>
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted truncate">
                {roleLabel.toLowerCase()}
                {' · '}
                {isFreeDomain
                  ? 'pro'
                  : <span className="text-ink-soft">${profile.balance}</span>}
              </div>
            </div>
            <span
              className="w-[26px] h-[26px] inline-flex items-center justify-center border border-hairline-soft rounded-sharp text-ink-soft group-hover:text-ink group-hover:border-hairline transition-colors"
              aria-hidden
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="1.4" stroke="currentColor" strokeWidth="1.1" />
                <path d="M6.5 1.5v1.5M6.5 10v1.5M1.5 6.5h1.5M10 6.5h1.5M3 3l1 1M9 9l1 1M3 10l1-1M9 4l1-1"
                      stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute bottom-[calc(100%-2px)] left-2.5 right-2.5 mb-1 bg-surface border border-hairline rounded-card overflow-hidden z-50">
              <div className="p-1">
                <Link href="/settings" className="h-9 flex items-center gap-2.5 px-2.5 rounded-sharp hover:bg-rail-soft text-ink">
                  <MenuIcon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  <span className="text-[12.5px] flex-1">Settings</span>
                </Link>

                {/* Archives — single home for everything the user has put away
                    from the chat list, projects index, or gallery. The page
                    itself groups by source and lets the user restore or
                    permanently delete from one place. */}
                <Link href="/archives" className="h-9 flex items-center gap-2.5 px-2.5 rounded-sharp hover:bg-rail-soft text-ink">
                  <MenuIcon path="M5 8h14l-1.4 11.2A2 2 0 0115.62 21H8.38a2 2 0 01-1.98-1.8L5 8zM4 4h16v4H4z" />
                  <span className="text-[12.5px] flex-1">Archives</span>
                </Link>

                <div className="h-9 flex items-center gap-2.5 px-2.5 rounded-sharp text-ink">
                  <MenuIcon path="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10" />
                  <span className="text-[12.5px] flex-1">Language</span>
                  <LanguageSwitcher />
                </div>

                <div className="h-9 flex items-center gap-2.5 px-2.5 rounded-sharp text-ink">
                  <MenuIcon path="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  <span className="text-[12.5px] flex-1">Theme</span>
                  <ThemeToggle />
                </div>

                {isSuperAdmin && (
                  <>
                    <div className="h-px bg-hairline-soft mx-2 my-1" />
                    <Link href="/admin" className="h-9 flex items-center gap-2.5 px-2.5 rounded-sharp hover:bg-rail-soft text-ink">
                      <MenuIcon path="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      <span className="text-[12.5px] flex-1">Super Admin</span>
                    </Link>
                    <Link href="/skills" className="h-9 flex items-center gap-2.5 px-2.5 rounded-sharp hover:bg-rail-soft text-ink">
                      <MenuIcon path="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      <span className="text-[12.5px] flex-1">Skills</span>
                    </Link>
                  </>
                )}

                <div className="h-px bg-hairline-soft mx-2 my-1" />

                <button onClick={handleSignOut} className="w-full h-9 flex items-center gap-2.5 px-2.5 rounded-sharp hover:bg-rail-soft text-left text-ink">
                  <MenuIcon path="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  <span className="text-[12.5px] flex-1">Sign out</span>
                </button>
                <button onClick={handleDeleteAccount} className="w-full h-9 flex items-center gap-2.5 px-2.5 rounded-sharp hover:bg-rail-soft text-left text-ink-muted">
                  <MenuIcon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  <span className="text-[12.5px] flex-1">Delete account</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ============================================================== */}
      {/* Main column                                                     */}
      {/* ============================================================== */}

      <main className="relative flex-1 min-w-0 flex flex-col bg-bg overflow-hidden">
        {children}
      </main>

      {/* ============================================================== */}
      {/* Right panel — sharp hairline, no rounded glass                  */}
      {/* ============================================================== */}

      {rightPanel && (
        <aside className="flex-none w-[320px] bg-surface border-l border-hairline overflow-hidden">
          {rightPanel}
        </aside>
      )}
    </div>
  )
}

function MenuIcon({ path }: { path: string }) {
  return (
    <svg className="w-3.5 h-3.5 text-ink-soft flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={path} />
    </svg>
  )
}
