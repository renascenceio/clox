/**
 * Client-only consent store. Reads / writes a single localStorage key, emits
 * a custom DOM event whenever the record changes, and exposes a tiny helper
 * surface for both the banner and any analytics code that wants to gate its
 * loading on a category.
 *
 * Server-side callers must not import this — every helper bails out fast if
 * `window` is undefined so the module is still safe to require from server
 * components, but no real work happens there.
 */

import {
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  type ConsentCategory,
  type ConsentRecord,
  type ConsentRegion,
  type ConsentState,
} from './types'

const CHANGE_EVENT = 'clox-consent-changed'
const OPEN_PREFS_EVENT = 'clox-consent-open-preferences'

const DEFAULT_STATE: ConsentState = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
}

/**
 * Detect the user's region as cheaply as possible. We use:
 *  - `navigator.language` (e.g. "fr-CH", "pt-BR", "en-CA")
 *  - the IANA timezone (a much better signal than the language for English-
 *    speaking countries — "Europe/London" vs "America/New_York")
 *
 * Both are local APIs — no network. The bucket only changes the prompt copy.
 */
export function detectRegion(): ConsentRegion {
  if (typeof window === 'undefined') return 'global'
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const lang = (navigator.language || '').toLowerCase()

    // Quebec — special status under Canadian law (Loi 25).
    if (tz === 'America/Toronto' || tz === 'America/Montreal' || lang === 'fr-ca') {
      if (tz.includes('Montreal') || lang === 'fr-ca') return 'ca-qc'
    }

    // California — covered by CCPA/CPRA. Best timezone proxy.
    if (tz.startsWith('America/Los_Angeles')) return 'us-ca'
    if (tz.startsWith('America/')) return 'us'

    if (tz === 'Europe/London' || lang === 'en-gb') return 'uk'
    if (tz === 'Europe/Zurich' || lang.endsWith('-ch')) return 'ch'
    if (tz.startsWith('Europe/')) return 'eea'

    if (tz.startsWith('America/Sao_Paulo') || lang === 'pt-br') return 'br'

    return 'global'
  } catch {
    return 'global'
  }
}

/**
 * Read the saved record. Returns `null` if the user has never decided, or if
 * the saved version is older than the current `CONSENT_VERSION` (which forces
 * a re-prompt on policy updates).
 */
export function getConsentRecord(): ConsentRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ConsentRecord
    if (!parsed || parsed.version !== CONSENT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

/** Get the live consent state — defaulting to "necessary only" when no
 *  decision has been made yet. */
export function getConsent(): ConsentState {
  const rec = getConsentRecord()
  return rec?.state ?? DEFAULT_STATE
}

/** Has the user made any decision yet? */
export function hasDecided(): boolean {
  return getConsentRecord() !== null
}

/** Whether a specific category is currently allowed. */
export function isAllowed(c: ConsentCategory): boolean {
  return getConsent()[c] === true
}

/**
 * Honour Global Privacy Control (`navigator.globalPrivacyControl`) and the
 * legacy DNT signal (`navigator.doNotTrack === '1'`). When either is set we
 * treat the user as opting out of analytics + marketing — but we still show
 * the banner for affirmative consent on functional cookies, because GPC does
 * not legally cover those in the EEA/UK.
 */
export function readAutomatedSignals(): { gpc: boolean; dnt: boolean } {
  if (typeof window === 'undefined') return { gpc: false, dnt: false }
  // GPC is a non-standard but widely shipped property; cast carefully.
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string }
  const gpc = nav.globalPrivacyControl === true
  const dnt = nav.doNotTrack === '1' || (typeof nav.doNotTrack === 'string' && nav.doNotTrack === 'yes')
  return { gpc, dnt }
}

/** Persist a record + broadcast a change event. */
export function saveConsent(state: ConsentState, method: ConsentRecord['method']): ConsentRecord {
  const record: ConsentRecord = {
    state: { ...state, necessary: true },
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    method,
    region: detectRegion(),
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
      window.dispatchEvent(new CustomEvent<ConsentRecord>(CHANGE_EVENT, { detail: record }))
    } catch {
      // Storage may be disabled (Safari private mode, third-party iframe, etc.)
      // — we still dispatch the event so the in-page UI updates.
      window.dispatchEvent(new CustomEvent<ConsentRecord>(CHANGE_EVENT, { detail: record }))
    }
  }
  return record
}

/** Convenience: accept all four categories. */
export function acceptAll(): ConsentRecord {
  return saveConsent({ necessary: true, functional: true, analytics: true, marketing: true }, 'accept-all')
}

/** Convenience: reject everything except strictly-necessary. */
export function rejectAll(): ConsentRecord {
  return saveConsent({ necessary: true, functional: false, analytics: false, marketing: false }, 'reject-all')
}

/** Convenience: open the customize sheet from anywhere (footer link, etc.). */
export function openPreferences(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OPEN_PREFS_EVENT))
}

/** Subscribe to consent changes. Returns an unsubscribe function. */
export function onConsentChange(handler: (rec: ConsentRecord) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const listener = (e: Event) => handler((e as CustomEvent<ConsentRecord>).detail)
  window.addEventListener(CHANGE_EVENT, listener)
  return () => window.removeEventListener(CHANGE_EVENT, listener)
}

/** Subscribe to "open preferences" requests (footer link, etc.). */
export function onOpenPreferences(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(OPEN_PREFS_EVENT, handler)
  return () => window.removeEventListener(OPEN_PREFS_EVENT, handler)
}
