'use client'

import { useEffect, useState } from 'react'
import { getCurrentLanguage, setCurrentLanguage } from '@/lib/translations'

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<'en' | 'ru'>('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const current = getCurrentLanguage()
    setLang(current === 'ru' ? 'ru' : 'en')
  }, [])

  const toggle = () => {
    const next = lang === 'en' ? 'ru' : 'en'
    setLang(next)
    setCurrentLanguage(next)
    window.dispatchEvent(new CustomEvent('language-changed', { detail: { langCode: next } }))
  }

  if (!mounted) return <div className="w-[58px] h-7" />

  const isRu = lang === 'ru'

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggle() }}
      onMouseDown={(e) => e.stopPropagation()}
      aria-label={`Switch to ${isRu ? 'English' : 'Russian'}`}
      className="relative flex items-center h-7 w-[58px] rounded-full bg-surface-tertiary dark:bg-surface border border-separator/50 flex-shrink-0 cursor-pointer"
    >
      {/* Sliding pill */}
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full gradient-brown-teal shadow-sm transition-all duration-200 ease-in-out ${isRu ? 'left-[30px]' : 'left-0.5'}`}
      />
      {/* EN label */}
      <span className={`absolute left-[6px] text-[10px] font-bold leading-none transition-colors duration-200 select-none ${!isRu ? 'text-white' : 'text-label-tertiary'}`}>
        EN
      </span>
      {/* RU label */}
      <span className={`absolute right-[5px] text-[10px] font-bold leading-none transition-colors duration-200 select-none ${isRu ? 'text-white' : 'text-label-tertiary'}`}>
        RU
      </span>
    </button>
  )
}
