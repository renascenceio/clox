'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check initial theme
    const theme = localStorage.getItem('theme')
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = theme === 'dark' || (!theme && systemDark)
    
    setIsDark(shouldBeDark)
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleTheme = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    
    if (newIsDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
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
