/**
 * Browser-side consent store. One record, kept in localStorage AND mirrored
 * to a first-party cookie, so every page, every open tab and the server read
 * the same answer. Every helper is a no-op on the server, so the module is
 * safe to import anywhere.
 */

import {
  CATEGORIES,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_DAYS,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  REGION_COOKIE,
  isRegion,
  type ConsentCategory,
  type ConsentRecord,
  type ConsentRegion,
  type ConsentState,
} from './types'
import { entriesFor, matches } from './registry'

const CHANGE_EVENT = 'clox-consent-changed'
const OPEN_PREFS_EVENT = 'clox-consent-open-preferences'
const LEGACY_KEYS = ['clox.consent.v1']
const METHODS: ConsentRecord['method'][] = ['accept-all', 'reject-all', 'custom', 'gpc', 'dnt']

export const DEFAULT_STATE: ConsentState = { necessary: true, functional: false, analytics: false, marketing: false }

const isBrowser = () => typeof window !== 'undefined'

// ─── cookies ────────────────────────────────────────────────────────────

function readCookie(name: string): string | null {
  if (!isBrowser()) return null
  const hit = document.cookie.split('; ').find((c) => c.startsWith(name + '='))
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null
}

function writeCookie(name: string, value: string, days: number) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${Math.round(days * 86400)}; Path=/; SameSite=Lax${secure}`
}

function expireCookie(name: string) {
  const host = location.hostname
  const parts = host.split('.')
  const domains = ['', host, ...parts.map((_, i) => '.' + parts.slice(i).join('.')).filter((d) => d.split('.').length > 2)]
  for (const d of domains) {
    document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ''}`
  }
}

/** `2|id|fam|method|epochSeconds|region` — compact enough for every request header. */
function toCookie(r: ConsentRecord): string {
  const bits = `${+r.state.functional}${+r.state.analytics}${+r.state.marketing}`
  return [r.version, r.id, bits, r.method, Math.floor(Date.parse(r.decidedAt) / 1000), r.region].join('|')
}

export function parseConsentCookie(raw: string | null | undefined): ConsentRecord | null {
  if (!raw) return null
  const [v, id, bits, method, ts, region] = raw.split('|')
  if (Number(v) !== CONSENT_VERSION || !/^[01]{3}$/.test(bits || '')) return null
  if (!METHODS.includes(method as ConsentRecord['method'])) return null
  const at = Number(ts) * 1000
  if (!Number.isFinite(at)) return null
  return {
    id: id || 'unknown',
    version: CONSENT_VERSION,
    state: { necessary: true, functional: bits[0] === '1', analytics: bits[1] === '1', marketing: bits[2] === '1' },
    method: method as ConsentRecord['method'],
    decidedAt: new Date(at).toISOString(),
    region: isRegion(region) ? region : 'global',
  }
}

// ─── region ─────────────────────────────────────────────────────────────

/**
 * The middleware sets `clox_region` from the edge geo headers (country +
 * state/province). Without it (local dev, blocked cookies) we fall back to
 * the time zone and browser language — local APIs, no network.
 */
export function detectRegion(): ConsentRegion {
  if (!isBrowser()) return 'global'
  const fromEdge = readCookie(REGION_COOKIE)
  if (isRegion(fromEdge)) return fromEdge
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const lang = (navigator.language || '').toLowerCase()
    if (tz === 'America/Montreal' || lang === 'fr-ca') return 'ca-qc'
    if (tz === 'America/Los_Angeles') return 'us-ca'
    if (/^America\/(New_York|Chicago|Denver|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise)/.test(tz) || tz === 'Pacific/Honolulu') return 'us'
    if (tz === 'America/Sao_Paulo' || lang === 'pt-br') return 'br'
    if (tz === 'Europe/London' || tz === 'Europe/Belfast' || lang === 'en-gb') return 'uk'
    if (tz === 'Europe/Zurich' || lang.endsWith('-ch')) return 'ch'
    if (tz.startsWith('Europe/') || tz === 'Atlantic/Reykjavik' || tz === 'Atlantic/Canary' || tz === 'Atlantic/Madeira' || tz === 'Atlantic/Azores') return 'eea'
    return 'global'
  } catch {
    return 'global'
  }
}

// ─── read ───────────────────────────────────────────────────────────────

function fresh(r: ConsentRecord | null): ConsentRecord | null {
  if (!r || r.version !== CONSENT_VERSION) return null
  const age = Date.now() - Date.parse(r.decidedAt)
  if (!Number.isFinite(age) || age > CONSENT_MAX_AGE_DAYS * 86400_000) return null
  return r
}

let cacheKey: string | null = null
let cacheValue: ConsentRecord | null = null

/** The saved decision, or `null` when undecided, outdated or older than 6 months. */
export function getConsentRecord(): ConsentRecord | null {
  if (!isBrowser()) return null
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
  } catch {
    // Storage blocked (private mode, embedded frame) — the cookie still works.
  }
  const cookie = readCookie(CONSENT_COOKIE)
  const key = `${raw}::${cookie}`
  if (key === cacheKey) return cacheValue

  let rec: ConsentRecord | null = null
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ConsentRecord
      rec = fresh(parsed?.state ? { ...parsed, state: { ...parsed.state, necessary: true } } : null)
    } catch {
      rec = null
    }
  }
  // Cookie wins when it is newer (another tab / subdomain decided later), or when storage is empty.
  const fromCookie = fresh(parseConsentCookie(cookie))
  if (fromCookie && (!rec || Date.parse(fromCookie.decidedAt) > Date.parse(rec.decidedAt))) rec = fromCookie

  cacheKey = key
  cacheValue = rec
  return rec
}

export function readAutomatedSignals(): { gpc: boolean; dnt: boolean } {
  if (!isBrowser()) return { gpc: false, dnt: false }
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; doNotTrack?: string | null; msDoNotTrack?: string }
  const win = window as Window & { doNotTrack?: string }
  const gpc = nav.globalPrivacyControl === true
  const dnt = [nav.doNotTrack, win.doNotTrack, nav.msDoNotTrack].some((v) => v === '1' || v === 'yes')
  return { gpc, dnt }
}

/**
 * Live consent. Global Privacy Control is a legally binding opt-out of sale /
 * sharing (CCPA, CPA, CTDPA…), so it overrides a stored "yes" for marketing.
 */
export function getConsent(): ConsentState {
  const state = getConsentRecord()?.state ?? DEFAULT_STATE
  if (state.marketing && readAutomatedSignals().gpc) return { ...state, marketing: false }
  return state
}

export function hasDecided(): boolean {
  return getConsentRecord() !== null
}

export function isAllowed(c: ConsentCategory): boolean {
  return getConsent()[c] === true
}

// ─── write ──────────────────────────────────────────────────────────────

function newId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  } catch {
    return Math.random().toString(36).slice(2, 14)
  }
}

/** Remove whatever the registry lists under categories that are now off. */
function purge(state: ConsentState) {
  for (const cat of CATEGORIES) {
    if (cat === 'necessary' || state[cat]) continue
    for (const entry of entriesFor(cat)) {
      if (entry.kind === 'cookie') {
        for (const c of document.cookie.split('; ')) {
          const name = c.split('=')[0]
          if (name && matches(entry.match, name)) expireCookie(name)
        }
      } else if (entry.kind === 'localStorage' || entry.kind === 'sessionStorage') {
        try {
          const store = entry.kind === 'localStorage' ? window.localStorage : window.sessionStorage
          for (const k of Object.keys(store)) if (matches(entry.match, k)) store.removeItem(k)
        } catch {
          /* storage blocked */
        }
      }
    }
  }
}

export function saveConsent(state: ConsentState, method: ConsentRecord['method']): ConsentRecord {
  const prev = getConsentRecord()
  const record: ConsentRecord = {
    id: prev?.id ?? newId(),
    state: { ...state, necessary: true },
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    method,
    region: detectRegion(),
  }
  if (!isBrowser()) return record
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
    for (const k of LEGACY_KEYS) window.localStorage.removeItem(k)
  } catch {
    /* storage blocked — the cookie below still records the choice */
  }
  try {
    writeCookie(CONSENT_COOKIE, toCookie(record), CONSENT_MAX_AGE_DAYS)
  } catch {
    /* cookies blocked */
  }
  purge(record.state)
  cacheKey = null
  window.dispatchEvent(new CustomEvent<ConsentRecord>(CHANGE_EVENT, { detail: record }))
  return record
}

export function acceptAll(): ConsentRecord {
  return saveConsent({ necessary: true, functional: true, analytics: true, marketing: true }, 'accept-all')
}

export function rejectAll(): ConsentRecord {
  return saveConsent({ ...DEFAULT_STATE }, 'reject-all')
}

// ─── events ─────────────────────────────────────────────────────────────

export function openPreferences(): void {
  if (!isBrowser()) return
  window.dispatchEvent(new Event(OPEN_PREFS_EVENT))
}

/** Fires on changes in this tab AND in other tabs of the same site. */
export function subscribeConsent(handler: () => void): () => void {
  if (!isBrowser()) return () => {}
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CONSENT_STORAGE_KEY) {
      cacheKey = null
      handler()
    }
  }
  // Cookie-only browsers (storage blocked) get no storage event — re-check on focus.
  const onFocus = () => {
    const before = cacheValue
    if (getConsentRecord() !== before) handler()
  }
  window.addEventListener(CHANGE_EVENT, handler)
  window.addEventListener('storage', onStorage)
  window.addEventListener('focus', onFocus)
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', onFocus)
  }
}

export function onConsentChange(handler: (rec: ConsentRecord) => void): () => void {
  return subscribeConsent(() => {
    const rec = getConsentRecord()
    if (rec) handler(rec)
  })
}

export function onOpenPreferences(handler: () => void): () => void {
  if (!isBrowser()) return () => {}
  window.addEventListener(OPEN_PREFS_EVENT, handler)
  return () => window.removeEventListener(OPEN_PREFS_EVENT, handler)
}
