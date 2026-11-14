'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { OmmaMark } from '@/shared/ui/brand/OmmaLogo'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const SNOOZE_KEY = 'omma.install.snoozed'
const SNOOZE_DAYS = 30
/** Only offer the install inside the app, never on the landing or legal pages. */
const APP_PATHS = ['/text', '/projects', '/files', '/history', '/gallery', '/skills', '/settings']

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function snoozed() {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY) || 0)
    return Date.now() - at < SNOOZE_DAYS * 86_400_000
  } catch {
    return false
  }
}

/**
 * Registers the service worker (production only, so dev and v0 previews never
 * serve cached files) and, on phones, offers to add Omma to the home screen
 * once: Android/Chrome gets an Install button, iPhone Safari gets the two taps.
 */
export function PwaClient() {
  const pathname = usePathname()
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    // Inside the v0 / iframe preview a worker would only get in the way.
    if (window.self !== window.top) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  }, [])

  useEffect(() => {
    if (isStandalone() || snoozed()) return
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    const ua = navigator.userAgent
    const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    if (iOS && safari) setIosHint(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const onPhone = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
  const inApp = APP_PATHS.some((p) => pathname === p || pathname?.startsWith(p + '/'))
  const offer = inApp && onPhone && (installEvent || iosHint)

  useEffect(() => {
    if (!offer) return
    const t = window.setTimeout(() => setOpen(true), 4000)
    return () => window.clearTimeout(t)
  }, [offer])

  if (!offer || !open) return null

  const close = () => {
    setOpen(false)
    setInstallEvent(null)
    setIosHint(false)
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()))
    } catch {}
  }

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice.catch(() => null)
    close()
  }

  return (
    <div
      role="dialog"
      aria-label="Add Omma to your home screen"
      className="fixed inset-x-3 z-[60] flex items-start gap-3 rounded-2xl bg-surface p-4 text-ink shadow-[0_12px_40px_rgba(0,0,0,0.28)]"
      style={{ bottom: 'calc(12px + env(safe-area-inset-bottom))' }}
    >
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent text-[#14171C]">
        <OmmaMark size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[15px] font-semibold leading-snug">Add Omma to your home screen</p>
        {installEvent ? (
          <p className="text-[13.5px] leading-snug text-ink-soft">Opens full screen like an app, straight into your chats.</p>
        ) : (
          <p className="text-[13.5px] leading-snug text-ink-soft">
            Tap <span className="font-semibold text-ink">Share</span>, then{' '}
            <span className="font-semibold text-ink">Add to Home Screen</span>.
          </p>
        )}
        <div className="mt-2 flex items-center gap-2">
          {installEvent ? (
            <button
              type="button"
              onClick={install}
              className="h-10 rounded-full bg-accent px-4 text-[14px] font-semibold text-[#14171C]"
            >
              Install
            </button>
          ) : null}
          <button type="button" onClick={close} className="h-10 rounded-full px-4 text-[14px] text-ink-soft">
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
