'use client'

import { useEffect, useState, useRef } from 'react'
import { SUPPORTED_LANGUAGES, getCurrentLanguage, setCurrentLanguage, getTranslationProgress } from '@/lib/translations'

export default function LanguageSwitcher() {
  const [mounted, setMounted] = useState(false)
  const [currentLang, setCurrentLang] = useState('en')
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    setMounted(true)
    setCurrentLang(getCurrentLanguage())

    const handleLangChange = (e: CustomEvent) => {
      setCurrentLang(e.detail.langCode)
    }
    window.addEventListener('language-changed', handleLangChange as EventListener)
    return () => window.removeEventListener('language-changed', handleLangChange as EventListener)
  }, [])

  const openDropdown = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      // Position below the button, right-aligned
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
    setIsOpen(true)
  }

  const changeLanguage = (langCode: string) => {
    setCurrentLang(langCode)
    setCurrentLanguage(langCode)
    setIsOpen(false)
  }

  if (!mounted) {
    return <div className="w-10 h-10" />
  }

  const currentLanguage = SUPPORTED_LANGUAGES.find(lang => lang.code === currentLang) || SUPPORTED_LANGUAGES[0]

  return (
    <>
      <button
        ref={buttonRef}
        onMouseDown={e => e.stopPropagation()}
        onClick={openDropdown}
        className="w-10 h-10 rounded-hig-lg bg-surface-secondary hover:bg-fill border border-separator/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label="Switch language"
      >
        <span className="text-base">{currentLanguage.flag}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop — stops mousedown so AppLayout outside-click doesn't close user menu */}
          <div
            className="fixed inset-0 z-[200]"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown — fixed to viewport so it's never clipped */}
          <div
            className="fixed w-56 bg-surface-secondary dark:bg-surface border border-separator rounded-hig-xl shadow-hig-hover overflow-hidden z-[201]"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="p-2 border-b border-separator">
              <div className="text-xs font-bold text-label-secondary uppercase tracking-widest px-2 py-1">
                Select Language
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const progress = lang.code !== 'en' ? getTranslationProgress(lang.code) : null
                return (
                  <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-hig-lg transition-all ${
                      currentLang === lang.code
                        ? 'bg-brown/10 dark:bg-teal/10 text-brown dark:text-teal border border-brown/20 dark:border-teal/20'
                        : 'hover:bg-surface-tertiary dark:hover:bg-surface-tertiary/50 text-label-primary'
                    }`}
                  >
                    <span className="text-xl">{lang.flag}</span>
                    <div className="flex-1 text-left">
                      <span className="text-sm font-medium">{lang.label}</span>
                      {progress && progress.percentage < 100 && (
                        <div className="text-[10px] text-label-tertiary">{progress.percentage}% translated</div>
                      )}
                    </div>
                    {currentLang === lang.code && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
