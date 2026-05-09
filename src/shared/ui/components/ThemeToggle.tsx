'use client'

import { useEffect, useState } from 'react'
import {
  getStoredPalette,
  setStoredPalette,
  type PaletteKey,
} from '@/shared/ui/chat/palettes'

/**
 * Lightweight light/dark toggle used outside the workspace shell
 * (e.g. on the marketing pages). Internally it delegates to the
 * single source of truth — `setStoredPalette` — so it stays in
 * sync with the workspace palette picker. Without that delegation,
 * a user could end up with `clox-palette = pearl` and `theme = dark`
 * in localStorage and watch the page flicker between palettes on
 * every navigation.
 */
export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Honour both the new `clox-palette` key (workspace picker) and
    // the legacy `theme` key (this component's older incarnation +
    // any system-dark preference for first-time visitors).
    const stored = getStoredPalette('pearl')
    const systemDark =
      stored === 'pearl' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    const shouldBeDark = stored === 'dark' || systemDark
    setIsDark(shouldBeDark)
    // The blocking <head> script in layout.tsx already applied the
    // attributes; we only need to react if the OS preference flips
    // the result for a first-time visitor with no stored choice.
    if (systemDark && stored === 'pearl') setStoredPalette('dark')
  }, [])

  const toggleTheme = () => {
    const next: PaletteKey = isDark ? 'pearl' : 'dark'
    setIsDark(!isDark)
    setStoredPalette(next)
  }

  if (!mounted) {
    return <div className="w-10 h-10" /> // Placeholder to prevent layout shift
  }

  return (
    <button
      onClick={toggleTheme}
      className="w-10 h-10 rounded-hig-lg bg-surface-secondary hover:bg-fill border border-separator/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      aria-label="Toggle theme"
    >
      {isDark ? (
        // Sun icon for light mode
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-label-primary">
          <circle cx="12" cy="12" r="4" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        // Moon icon for dark mode
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-label-primary">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
