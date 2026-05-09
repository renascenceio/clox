'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  acceptAll,
  detectRegion,
  getConsentRecord,
  hasDecided,
  onOpenPreferences,
  readAutomatedSignals,
  rejectAll,
  saveConsent,
} from '@/lib/consent/store'
import type {
  ConsentCategory,
  ConsentRegion,
  ConsentState,
} from '@/lib/consent/types'

/**
 * Compliance posture, by jurisdiction, in one component:
 *
 *   EEA / UK / CH ─ no pre-checked boxes, equal weight to "Reject all" and
 *                   "Accept all" (EDPB Guidelines 03/2022), withdrawal of
 *                   consent must be as easy as giving it (footer link does
 *                   that), granular per-category controls in the sheet.
 *
 *   US (CA + others) ─ banner doubles as a "Do Not Sell or Share My Personal
 *                       Information" notice. GPC signal auto-applies and is
 *                       acknowledged in the copy.
 *
 *   BR / QC / Global ─ same granular controls; copy nuanced per region.
 *
 * We keep the same UI in every region — only the headline + one helper line
 * change — so users in jurisdictions without a strict mandate still get the
 * same level of control. That is the safest forward-compatible posture as
 * regulation tightens (e.g. Texas TDPSA, Florida FDBR, India DPDP Act, etc.).
 */

type Mode = 'banner' | 'preferences'

const COPY: Record<ConsentRegion, { headline: string; body: string; rejectLabel: string }> = {
  eea: {
    headline: 'Cookies & tracking',
    body: 'We use strictly-necessary cookies to run this site. With your consent, we also use functional, analytics, and marketing cookies. You can accept, reject, or pick categories below — and change your mind anytime via the Cookie settings link in the footer.',
    rejectLabel: 'Reject all',
  },
  uk: {
    headline: 'Cookies & tracking',
    body: 'We use strictly-necessary cookies to run this site. With your consent, we also set functional, analytics, and marketing cookies under PECR and the UK GDPR. You can accept, reject, or pick categories below — and change your mind anytime.',
    rejectLabel: 'Reject all',
  },
  ch: {
    headline: 'Cookies & tracking',
    body: 'We use strictly-necessary cookies to run this site. With your consent — required under the revised Swiss FADP — we also set functional, analytics, and marketing cookies. Pick categories below or change your mind anytime.',
    rejectLabel: 'Reject all',
  },
  'us-ca': {
    headline: 'Your privacy choices',
    body: 'We use cookies and similar technologies. Under the CCPA / CPRA you can opt out of the sale or sharing of personal information for cross-context behavioural advertising. We also honour the Global Privacy Control browser signal automatically.',
    rejectLabel: 'Opt out of sale / sharing',
  },
  us: {
    headline: 'Your privacy choices',
    body: 'We use cookies and similar technologies, including for analytics and advertising. You can limit non-essential tracking below or change your mind anytime via the Cookie settings link in the footer.',
    rejectLabel: 'Opt out of non-essential',
  },
  br: {
    headline: 'Cookies e privacidade',
    body: 'Usamos cookies estritamente necessários para operar o site. Com o seu consentimento, sob a LGPD, também usamos cookies funcionais, analíticos e de marketing. Aceite, recuse ou escolha categorias abaixo.',
    rejectLabel: 'Recusar todos',
  },
  'ca-qc': {
    headline: 'Cookies & vie privée',
    body: 'Sous la Loi 25, nous obtenons votre consentement explicite avant tout traceur non essentiel. Acceptez, refusez ou choisissez ci-dessous — vous pouvez changer d’avis à tout moment.',
    rejectLabel: 'Tout refuser',
  },
  global: {
    headline: 'Cookies & tracking',
    body: 'We use strictly-necessary cookies to run this site. With your consent, we also use functional, analytics, and marketing cookies. Accept, reject, or pick categories below — and change your mind anytime via the footer.',
    rejectLabel: 'Reject all',
  },
}

const CATEGORIES: {
  key: ConsentCategory
  label: string
  description: string
  always?: boolean
}[] = [
  {
    key: 'necessary',
    label: 'Strictly necessary',
    description:
      'Authentication, session integrity, CSRF protection, security signals. Always on — the site does not work without these.',
    always: true,
  },
  {
    key: 'functional',
    label: 'Functional',
    description:
      'Remember your preferences (theme, sidebar collapse state, language). Off by default; turn on for a smoother experience across visits.',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description:
      'Aggregated, pseudonymised usage statistics so we can see which features get used and where things break. We do not sell or share this data.',
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description:
      'Measure the effectiveness of our campaigns and, where applicable, show relevant ads on third-party sites. Off by default.',
  },
]

const FALLBACK: ConsentState = { necessary: true, functional: false, analytics: false, marketing: false }

export default function CookieConsent() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('banner')
  const [region, setRegion] = useState<ConsentRegion>('global')
  const [draft, setDraft] = useState<ConsentState>(FALLBACK)
  const [signals, setSignals] = useState<{ gpc: boolean; dnt: boolean }>({ gpc: false, dnt: false })

  // Decide whether to show the banner at mount time.
  useEffect(() => {
    setMounted(true)
    const r = detectRegion()
    setRegion(r)
    const automated = readAutomatedSignals()
    setSignals(automated)

    if (!hasDecided()) {
      // If GPC or DNT is set, auto-apply a "reject non-essential" decision
      // and skip the banner entirely. This is the cleanest way to honour
      // the signal without nagging the user.
      if (automated.gpc) {
        saveConsent({ ...FALLBACK }, 'gpc')
        return
      }
      if (automated.dnt) {
        saveConsent({ ...FALLBACK }, 'dnt')
        return
      }
      setDraft(FALLBACK)
      setOpen(true)
      setMode('banner')
    } else {
      // If the user has already decided, prime the draft from the saved
      // record so opening the customize sheet shows their actual state.
      const rec = getConsentRecord()
      if (rec) setDraft(rec.state)
    }
  }, [])

  // Footer link / programmatic opens.
  useEffect(() => {
    const off = onOpenPreferences(() => {
      const rec = getConsentRecord()
      setDraft(rec?.state ?? FALLBACK)
      setOpen(true)
      setMode('preferences')
    })
    return off
  }, [])

  // Close on Escape when the customize sheet is open. The first-visit banner
  // is intentionally non-dismissible without a decision (regulators view a
  // bare "X" close button as implied consent — that's not OK in EEA).
  useEffect(() => {
    if (!open || mode !== 'preferences') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, mode])

  const copy = useMemo(() => COPY[region] ?? COPY.global, [region])

  const acceptAndClose = useCallback(() => {
    acceptAll()
    setOpen(false)
  }, [])
  const rejectAndClose = useCallback(() => {
    rejectAll()
    setOpen(false)
  }, [])
  const saveAndClose = useCallback(() => {
    saveConsent(draft, 'custom')
    setOpen(false)
  }, [draft])

  if (!mounted || !open) return null

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1000] pointer-events-none px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8"
      role="region"
      aria-label="Cookie consent"
    >
      {mode === 'banner' ? (
        <BannerCard
          copy={copy}
          signals={signals}
          onAccept={acceptAndClose}
          onReject={rejectAndClose}
          onCustomize={() => setMode('preferences')}
        />
      ) : (
        <PreferencesSheet
          copy={copy}
          draft={draft}
          onChange={(c, v) => setDraft((d) => ({ ...d, [c]: v }))}
          onAccept={acceptAndClose}
          onReject={rejectAndClose}
          onSave={saveAndClose}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Banner ─────────────────────────────────────────────────────────────────

function BannerCard({
  copy,
  signals,
  onAccept,
  onReject,
  onCustomize,
}: {
  copy: (typeof COPY)[ConsentRegion]
  signals: { gpc: boolean; dnt: boolean }
  onAccept: () => void
  onReject: () => void
  onCustomize: () => void
}) {
  return (
    <div className="pointer-events-auto mx-auto max-w-[1180px] bg-surface border border-hairline shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] flex flex-col md:flex-row md:items-center gap-5 md:gap-8 p-5 md:p-6">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-muted mb-2">
          {copy.headline}
        </div>
        <p className="text-[13px] leading-relaxed text-ink-soft text-pretty max-w-[68ch]">{copy.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10px] tracking-[0.06em] text-ink-muted">
          <Link href="/privacy" className="hover:text-ink underline-offset-2 hover:underline">
            Privacy policy
          </Link>
          <Link href="/cookies" className="hover:text-ink underline-offset-2 hover:underline">
            Cookie policy
          </Link>
          <Link href="/terms" className="hover:text-ink underline-offset-2 hover:underline">
            Terms
          </Link>
          {signals.gpc ? <span className="text-ink-muted/80">GPC detected</span> : null}
          {!signals.gpc && signals.dnt ? <span className="text-ink-muted/80">DNT detected</span> : null}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-2 sm:gap-3 md:min-w-[280px] lg:min-w-[360px]">
        <button
          type="button"
          onClick={onReject}
          className="flex-1 px-4 py-2.5 border border-hairline text-[12px] font-mono tracking-[0.06em] uppercase text-ink-soft hover:bg-rail-soft hover:text-ink transition-colors"
        >
          {copy.rejectLabel}
        </button>
        <button
          type="button"
          onClick={onCustomize}
          className="flex-1 px-4 py-2.5 border border-hairline text-[12px] font-mono tracking-[0.06em] uppercase text-ink-soft hover:bg-rail-soft hover:text-ink transition-colors"
        >
          Customize
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="flex-1 px-4 py-2.5 bg-ink text-surface text-[12px] font-mono tracking-[0.06em] uppercase hover:bg-ink/90 transition-colors"
        >
          Accept all
        </button>
      </div>
    </div>
  )
}

// ─── Preferences sheet ──────────────────────────────────────────────────────

function PreferencesSheet({
  copy,
  draft,
  onChange,
  onAccept,
  onReject,
  onSave,
  onClose,
}: {
  copy: (typeof COPY)[ConsentRegion]
  draft: ConsentState
  onChange: (c: ConsentCategory, v: boolean) => void
  onAccept: () => void
  onReject: () => void
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div className="pointer-events-auto mx-auto max-w-[760px] bg-surface border border-hairline shadow-[0_24px_60px_-30px_rgba(0,0,0,0.35)] flex flex-col max-h-[80vh]">
      <header className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-hairline">
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink-muted">{copy.headline}</div>
          <h2 className="text-[16px] text-ink mt-0.5">Manage your cookie preferences</h2>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="p-1.5 text-ink-muted hover:text-ink transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
            <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <div className="overflow-y-auto px-5 md:px-6 py-5 space-y-4">
        <p className="text-[13px] leading-relaxed text-ink-soft text-pretty">{copy.body}</p>

        <div className="border-t border-hairline-soft">
          {CATEGORIES.map((c) => (
            <CategoryRow
              key={c.key}
              label={c.label}
              description={c.description}
              checked={draft[c.key]}
              disabled={c.always}
              onChange={(v) => onChange(c.key, v)}
            />
          ))}
        </div>

        <div className="font-mono text-[10px] tracking-[0.06em] text-ink-muted leading-relaxed">
          You can withdraw or change your consent at any time via the{' '}
          <strong className="text-ink-soft">Cookie settings</strong> link in the footer. Read our{' '}
          <Link href="/privacy" className="text-ink-soft underline-offset-2 hover:underline">
            privacy policy
          </Link>{' '}
          and{' '}
          <Link href="/cookies" className="text-ink-soft underline-offset-2 hover:underline">
            cookie policy
          </Link>{' '}
          for details on retention and the legal bases for each category.
        </div>
      </div>

      <footer className="flex flex-col sm:flex-row gap-2 sm:gap-3 px-5 md:px-6 py-4 border-t border-hairline">
        <button
          type="button"
          onClick={onReject}
          className="flex-1 px-4 py-2.5 border border-hairline text-[12px] font-mono tracking-[0.06em] uppercase text-ink-soft hover:bg-rail-soft hover:text-ink transition-colors"
        >
          {copy.rejectLabel}
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="flex-1 px-4 py-2.5 border border-hairline text-[12px] font-mono tracking-[0.06em] uppercase text-ink-soft hover:bg-rail-soft hover:text-ink transition-colors"
        >
          Accept all
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex-1 px-4 py-2.5 bg-ink text-surface text-[12px] font-mono tracking-[0.06em] uppercase hover:bg-ink/90 transition-colors"
        >
          Save preferences
        </button>
      </footer>
    </div>
  )
}

function CategoryRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-4 py-3.5 border-b border-hairline-soft last:border-b-0 cursor-pointer">
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] text-ink">{label}</span>
        <span className="block text-[12px] text-ink-muted leading-relaxed mt-0.5 text-pretty">{description}</span>
      </span>
      <span className="shrink-0 mt-0.5">
        <Toggle checked={checked} disabled={disabled} onChange={onChange} />
      </span>
    </label>
  )
}

function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-[18px] w-8 items-center border transition-colors ${
        disabled
          ? 'border-hairline bg-rail-soft cursor-not-allowed'
          : checked
            ? 'border-ink bg-ink'
            : 'border-hairline bg-surface hover:border-ink/60'
      }`}
    >
      <span
        className={`inline-block h-[12px] w-[12px] transition-transform ${
          checked ? 'translate-x-[16px] bg-surface' : 'translate-x-[2px] bg-ink-soft'
        }`}
        aria-hidden
      />
    </button>
  )
}
