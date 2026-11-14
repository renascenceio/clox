'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import {
  DEFAULT_STATE,
  acceptAll,
  detectRegion,
  getConsentRecord,
  hasDecided,
  onOpenPreferences,
  readAutomatedSignals,
  rejectAll,
  saveConsent,
} from '@/lib/consent/store'
import { entriesFor } from '@/lib/consent/registry'
import { CATEGORIES, CATEGORY_COPY, type ConsentCategory, type ConsentRegion, type ConsentState } from '@/lib/consent/types'

/**
 * One consent UI for every page, region and screen size.
 *
 *  - First visit: a non-blocking banner. "Reject all" and "Accept all" look
 *    exactly the same (EDPB 03/2022: refusing must be as easy as accepting),
 *    there is no pre-ticked box and no "X" that would count as consent.
 *  - GPC / Do Not Track: we record "necessary only" and never show the banner.
 *  - "Customize" / "Cookie settings" (footer, user menu, /settings, /cookies):
 *    a modal dialog — bottom sheet on phones, centred on desktop — listing
 *    every cookie and tracker per category from the registry.
 */

type Copy = {
  headline: string
  body: string
  reject: string
  accept: string
  customize: string
  save: string
  title: string
}

const EN = { accept: 'Accept all', customize: 'Customize', save: 'Save choices', title: 'Cookie preferences' }

const COPY: Record<ConsentRegion, Copy> = {
  eea: {
    ...EN,
    headline: 'Cookies & tracking',
    body: 'We use necessary storage to run Omma. With your consent we also measure page views and speed. Nothing optional runs until you choose, and you can change your mind any time.',
    reject: 'Reject all',
  },
  uk: {
    ...EN,
    headline: 'Cookies & tracking',
    body: 'We use necessary storage to run Omma. With your consent (PECR and UK GDPR) we also measure page views and speed. Nothing optional runs until you choose.',
    reject: 'Reject all',
  },
  ch: {
    ...EN,
    headline: 'Cookies & tracking',
    body: 'We use necessary storage to run Omma. With your consent under the revised FADP we also measure page views and speed. Nothing optional runs until you choose.',
    reject: 'Reject all',
  },
  'us-ca': {
    ...EN,
    headline: 'Your privacy choices',
    body: 'We use necessary storage to run Omma and, if you agree, anonymous analytics. We do not sell or share personal information, and we honour Global Privacy Control automatically.',
    reject: 'Do not sell or share',
  },
  us: {
    ...EN,
    headline: 'Your privacy choices',
    body: 'We use necessary storage to run Omma and, if you agree, anonymous analytics. Optional tracking stays off until you choose, and Global Privacy Control is honoured.',
    reject: 'Reject optional',
  },
  br: {
    headline: 'Cookies e privacidade',
    body: 'Usamos armazenamento necessário para o Omma funcionar. Com o seu consentimento (LGPD), também medimos visitas e desempenho. Nada opcional é ativado até você escolher.',
    reject: 'Recusar todos',
    accept: 'Aceitar todos',
    customize: 'Personalizar',
    save: 'Salvar escolhas',
    title: 'Preferências de cookies',
  },
  'ca-qc': {
    headline: 'Témoins et vie privée',
    body: 'Nous utilisons le stockage nécessaire au fonctionnement de Omma. Avec votre consentement (Loi 25), nous mesurons aussi les visites et la performance. Rien d’optionnel n’est activé avant votre choix.',
    reject: 'Tout refuser',
    accept: 'Tout accepter',
    customize: 'Personnaliser',
    save: 'Enregistrer',
    title: 'Préférences de témoins',
  },
  global: {
    ...EN,
    headline: 'Cookies & tracking',
    body: 'We use necessary storage to run Omma. With your consent we also measure page views and speed. Nothing optional runs until you choose, and you can change your mind any time.',
    reject: 'Reject all',
  },
}

type View = 'closed' | 'banner' | 'preferences'

export default function CookieConsent() {
  const [view, setView] = useState<View>('closed')
  const [region, setRegion] = useState<ConsentRegion>('global')
  const [draft, setDraft] = useState<ConsentState>(DEFAULT_STATE)
  const [gpc, setGpc] = useState(false)
  const [toast, setToast] = useState('')
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setRegion(detectRegion())
    const signals = readAutomatedSignals()
    setGpc(signals.gpc)
    if (hasDecided()) return
    if (signals.gpc || signals.dnt) {
      saveConsent({ ...DEFAULT_STATE }, signals.gpc ? 'gpc' : 'dnt')
      return
    }
    setView('banner')
  }, [])

  useEffect(
    () =>
      onOpenPreferences(() => {
        returnFocus.current = document.activeElement as HTMLElement | null
        setRegion(detectRegion())
        setDraft(getConsentRecord()?.state ?? DEFAULT_STATE)
        setView('preferences')
      }),
    [],
  )

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const finish = useCallback((message: string) => {
    setView('closed')
    setToast(message)
    window.setTimeout(() => returnFocus.current?.focus?.(), 0)
  }, [])

  const copy = COPY[region] ?? COPY.global

  return (
    <>
      {view === 'banner' ? (
        <Banner
          copy={copy}
          onAccept={() => (acceptAll(), finish('Cookie choices saved: all accepted.'))}
          onReject={() => (rejectAll(), finish('Cookie choices saved: only necessary.'))}
          onCustomize={() => {
            returnFocus.current = document.activeElement as HTMLElement | null
            setDraft(DEFAULT_STATE)
            setView('preferences')
          }}
        />
      ) : null}

      {view === 'preferences' ? (
        <Preferences
          copy={copy}
          draft={draft}
          gpc={gpc}
          dismissible={hasDecided()}
          onChange={(c, v) => setDraft((d) => ({ ...d, [c]: v }))}
          onAccept={() => (acceptAll(), finish('Cookie choices saved: all accepted.'))}
          onReject={() => (rejectAll(), finish('Cookie choices saved: only necessary.'))}
          onSave={() => (saveConsent({ ...draft, marketing: gpc ? false : draft.marketing }, 'custom'), finish('Cookie choices saved.'))}
          onClose={() => setView(hasDecided() ? 'closed' : 'banner')}
        />
      ) : null}

      <div aria-live="polite" role="status" className="sr-only">
        {toast}
      </div>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1001] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] print:hidden">
          <div className="border border-hairline bg-surface px-4 py-2.5 font-mono text-[11px] tracking-[0.04em] text-ink shadow-[0_18px_40px_-24px_rgba(0,0,0,0.45)]">
            {toast}
          </div>
        </div>
      ) : null}
    </>
  )
}

// ─── Banner ─────────────────────────────────────────────────────────────

const BTN =
  'inline-flex min-h-11 items-center justify-center px-4 text-center font-mono text-[11.5px] uppercase tracking-[0.06em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink'
const BTN_SOLID = `${BTN} bg-ink text-surface hover:bg-ink/90`
const BTN_LINE = `${BTN} border border-hairline text-ink-soft hover:bg-rail-soft hover:text-ink`

function Banner({
  copy,
  onAccept,
  onReject,
  onCustomize,
}: {
  copy: Copy
  onAccept: () => void
  onReject: () => void
  onCustomize: () => void
}) {
  const titleId = useId()
  const bodyId = useId()
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      className="fixed inset-x-0 bottom-0 z-[1000] print:hidden sm:px-6 sm:pb-6"
    >
      <div className="mx-auto flex max-h-[70dvh] max-w-[1120px] flex-col gap-4 overflow-y-auto border-t border-hairline bg-surface px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-24px_rgba(0,0,0,0.45)] sm:border sm:p-5 md:flex-row md:items-center md:gap-8 md:p-6">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">
            {copy.headline}
          </h2>
          <p id={bodyId} className="mt-1.5 max-w-[68ch] text-pretty text-[13.5px] leading-relaxed text-ink-soft">
            {copy.body}
          </p>
          <nav aria-label="Privacy documents" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] tracking-[0.04em] text-ink-muted">
            <Link href="/privacy" className="py-1 underline-offset-2 hover:text-ink hover:underline">
              Privacy policy
            </Link>
            <Link href="/cookies" className="py-1 underline-offset-2 hover:text-ink hover:underline">
              Cookie policy
            </Link>
          </nav>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 md:w-[400px] md:grid-cols-3">
          <button type="button" onClick={onReject} className={BTN_SOLID}>
            {copy.reject}
          </button>
          <button type="button" onClick={onAccept} className={BTN_SOLID}>
            {copy.accept}
          </button>
          <button type="button" onClick={onCustomize} className={`${BTN_LINE} col-span-2 md:order-first md:col-span-1`}>
            {copy.customize}
          </button>
        </div>
      </div>
    </section>
  )
}

// ─── Preferences dialog ─────────────────────────────────────────────────

function Preferences({
  copy,
  draft,
  gpc,
  dismissible,
  onChange,
  onAccept,
  onReject,
  onSave,
  onClose,
}: {
  copy: Copy
  draft: ConsentState
  gpc: boolean
  dismissible: boolean
  onChange: (c: ConsentCategory, v: boolean) => void
  onAccept: () => void
  onReject: () => void
  onSave: () => void
  onClose: () => void
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const record = getConsentRecord()
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const items = Array.from(
        panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      html.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center print:hidden sm:items-center sm:p-6">
      <div aria-hidden className="absolute inset-0 bg-ink/45" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full flex-col border-t border-hairline bg-surface shadow-[0_24px_60px_-30px_rgba(0,0,0,0.5)] sm:max-h-[min(86dvh,780px)] sm:max-w-[640px] sm:border"
      >
        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4 md:px-6">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">{copy.headline}</p>
            <h2 id={titleId} className="mt-0.5 text-[17px] leading-snug text-ink">
              {copy.title}
            </h2>
          </div>
          <button
            type="button"
            data-autofocus
            aria-label={dismissible ? 'Close' : 'Back'}
            onClick={onClose}
            className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 md:px-6">
          <p className="text-pretty text-[13.5px] leading-relaxed text-ink-soft">{copy.body}</p>

          {gpc ? (
            <p className="mt-3 border-l-2 border-ink/40 pl-3 text-[12.5px] leading-relaxed text-ink-soft">
              Your browser sends Global Privacy Control, so marketing stays off as an opt-out of sale or sharing.
            </p>
          ) : null}

          <ul className="mt-3 divide-y divide-hairline-soft border-y border-hairline-soft">
            {CATEGORIES.map((c) => (
              <CategoryRow
                key={c}
                category={c}
                checked={c === 'marketing' && gpc ? false : draft[c]}
                locked={c === 'necessary' || (c === 'marketing' && gpc)}
                onChange={(v) => onChange(c, v)}
              />
            ))}
          </ul>

          <p className="mt-4 text-[12px] leading-relaxed text-ink-muted">
            Change or withdraw consent any time from <strong className="font-medium text-ink-soft">Cookie settings</strong> in the
            footer, your account menu or Settings. See the{' '}
            <Link href="/cookies" className="text-ink-soft underline underline-offset-2">
              cookie policy
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-ink-soft underline underline-offset-2">
              privacy policy
            </Link>
            .
          </p>
          {record ? (
            <p className="mt-2 font-mono text-[10.5px] tracking-[0.04em] text-ink-muted">
              Consent ID {record.id} · saved {new Date(record.decidedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </p>
          ) : null}
        </div>

        <footer className="grid grid-cols-2 gap-2 border-t border-hairline px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:grid-cols-3 sm:pb-4 md:px-6">
          <button type="button" onClick={onReject} className={BTN_LINE}>
            {copy.reject}
          </button>
          <button type="button" onClick={onAccept} className={BTN_LINE}>
            {copy.accept}
          </button>
          <button type="button" onClick={onSave} className={`${BTN_SOLID} col-span-2 sm:col-span-1`}>
            {copy.save}
          </button>
        </footer>
      </div>
    </div>
  )
}

function CategoryRow({
  category,
  checked,
  locked,
  onChange,
}: {
  category: ConsentCategory
  checked: boolean
  locked: boolean
  onChange: (v: boolean) => void
}) {
  const labelId = useId()
  const descId = useId()
  const copy = CATEGORY_COPY[category]
  const entries = entriesFor(category)
  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p id={labelId} className="text-[14px] text-ink">
            {copy.label}
            {category === 'necessary' ? (
              <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">Always on</span>
            ) : null}
          </p>
          <p id={descId} className="mt-0.5 text-pretty text-[12.5px] leading-relaxed text-ink-muted">
            {copy.description}
          </p>
        </div>
        <Switch checked={checked} disabled={locked} labelledBy={labelId} describedBy={descId} onChange={onChange} />
      </div>
      <details className="group mt-2">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
          <svg className="h-2.5 w-2.5 transition-transform group-open:rotate-90" viewBox="0 0 10 10" aria-hidden>
            <path d="M3 1.5 6.5 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          {entries.length ? `What this covers (${entries.length})` : 'What this covers'}
        </summary>
        {entries.length ? (
          <ul className="mt-1.5 space-y-2 border-l border-hairline-soft pl-3">
            {entries.map((e) => (
              <li key={e.match} className="text-[12px] leading-relaxed">
                <span className="break-all font-mono text-[11px] text-ink">{e.match}</span>
                <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-muted">
                  {e.kind === 'script' ? 'script' : e.kind} · {e.provider}
                </span>
                <span className="block text-ink-muted">
                  {e.purpose} <span className="text-ink-soft">{e.duration}.</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 border-l border-hairline-soft pl-3 text-[12px] text-ink-muted">Nothing in this category is in use right now.</p>
        )}
      </details>
    </li>
  )
}

function Switch({
  checked,
  disabled,
  labelledBy,
  describedBy,
  onChange,
}: {
  checked: boolean
  disabled: boolean
  labelledBy: string
  describedBy: string
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => !disabled && onChange(!checked)}
      className={`-my-2 -mr-2 inline-flex h-11 w-14 shrink-0 items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <span
        aria-hidden
        className={`relative inline-flex h-[22px] w-10 items-center border transition-colors ${
          disabled ? 'border-hairline bg-rail-soft opacity-70' : checked ? 'border-ink bg-ink' : 'border-hairline bg-surface'
        }`}
      >
        <span
          className={`inline-block h-[14px] w-[14px] transition-transform motion-reduce:transition-none ${
            checked ? 'translate-x-[21px]' : 'translate-x-[3px]'
          } ${checked && !disabled ? 'bg-surface' : 'bg-ink-soft'}`}
        />
      </span>
    </button>
  )
}
