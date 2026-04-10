'use client'

import { useEffect, useState } from 'react'
import { getCurrentLanguage, setCurrentLanguage } from '@/lib/translations'

export default function LanguageSwitcher() {
  const [mounted, setMounted] = useState(false)
  const [currentLang, setCurrentLang] = useState('en')

  useEffect(() => {
    setMounted(true)
    setCurrentLang(getCurrentLanguage())
    const handler = (e: CustomEvent) => setCurrentLang(e.detail.langCode)
    window.addEventListener('language-changed', handler as EventListener)
    return () => window.removeEventListener('language-changed', handler as EventListener)
  }, [])

  const toggle = () => {
    const next = currentLang === 'en' ? 'ru' : 'en'
    setCurrentLang(next)
    setCurrentLanguage(next)
  }

  if (!mounted) return <div className="w-16 h-7" />

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle() }}
      onMouseDown={(e) => e.stopPropagation()}
      className="flex items-center gap-0.5 p-0.5 rounded-full bg-surface-tertiary dark:bg-surface border border-separator/50 transition-all hover:border-brown/40 dark:hover:border-teal/40"
      aria-label="Toggle language"
    >
      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
        currentLang === 'en'
          ? 'bg-brown dark:bg-teal text-white shadow-sm'
          : 'text-label-tertiary hover:text-label-secondary'
      }`}>
        EN
      </span>
      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
        currentLang === 'ru'
          ? 'bg-brown dark:bg-teal text-white shadow-sm'
          : 'text-label-tertiary hover:text-label-secondary'
      }`}>
        RU
      </span>
    </button>
  )
}
