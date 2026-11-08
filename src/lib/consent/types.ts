/**
 * Cookie / tracking consent — one shape shared by the banner, the preferences
 * dialog, the settings page, the /cookies policy, the analytics loader and the
 * middleware (which sets the region hint).
 *
 * The four categories mirror the EDPB / IAB "necessary | functional |
 * analytics | marketing" split, so the same record covers GDPR + ePrivacy
 * (EEA), UK GDPR + PECR, Swiss revFADP, LGPD (BR), Quebec Law 25, POPIA,
 * India DPDP and the US state laws (CCPA/CPRA plus the VA/CO/CT/TX/OR…
 * sister statutes). Everything except "necessary" is OFF until the person
 * opts in — in every region, including opt-out regimes — and Global Privacy
 * Control always wins over a stored "yes" for marketing (sale / sharing).
 */
export type ConsentCategory = 'necessary' | 'functional' | 'analytics' | 'marketing'

export const CATEGORIES: ConsentCategory[] = ['necessary', 'functional', 'analytics', 'marketing']

export interface ConsentState {
  necessary: true
  functional: boolean
  analytics: boolean
  marketing: boolean
}

export interface ConsentRecord {
  /** Random id so a person can quote their consent in a privacy request. */
  id: string
  state: ConsentState
  version: number
  decidedAt: string
  method: 'accept-all' | 'reject-all' | 'custom' | 'gpc' | 'dnt'
  region: ConsentRegion
}

/**
 * Region buckets decide only which wording and legal references we show —
 * never which controls someone gets, and never pre-ticked consent.
 */
export type ConsentRegion =
  | 'eea'   // GDPR + ePrivacy (EU 27 + Iceland, Liechtenstein, Norway)
  | 'uk'    // UK GDPR + PECR
  | 'ch'    // Swiss revFADP
  | 'us-ca' // CCPA / CPRA
  | 'us'    // other US states
  | 'br'    // LGPD
  | 'ca-qc' // Quebec Law 25
  | 'global'

/** Bump when the purposes or the inventory change — everyone is asked again. */
export const CONSENT_VERSION = 2
export const CONSENT_STORAGE_KEY = 'clox.consent.v2'
/** First-party cookie mirror, so the server and every tab see the same choice. */
export const CONSENT_COOKIE = 'clox_consent'
/** Session cookie the middleware sets from the edge geo headers. */
export const REGION_COOKIE = 'clox_region'
/** Consent is asked again after this many days (CNIL / EDPB guidance: ~6 months). */
export const CONSENT_MAX_AGE_DAYS = 180

const EEA = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
  // Outermost regions / territories that geo-IP reports separately.
  'GF', 'GP', 'MQ', 'RE', 'YT', 'MF', 'AX',
])

/** Map an ISO country (+ optional subdivision) to a consent region. Shared by middleware and the browser. */
export function regionFromGeo(country?: string | null, subdivision?: string | null): ConsentRegion {
  const c = (country || '').toUpperCase()
  const s = (subdivision || '').toUpperCase()
  if (!c) return 'global'
  if (EEA.has(c)) return 'eea'
  if (c === 'GB' || c === 'UK' || c === 'GG' || c === 'JE' || c === 'IM') return 'uk'
  if (c === 'CH') return 'ch'
  if (c === 'US') return s === 'CA' ? 'us-ca' : 'us'
  if (c === 'BR') return 'br'
  if (c === 'CA' && s === 'QC') return 'ca-qc'
  return 'global'
}

export const REGIONS: ConsentRegion[] = ['eea', 'uk', 'ch', 'us-ca', 'us', 'br', 'ca-qc', 'global']

export function isRegion(v: unknown): v is ConsentRegion {
  return typeof v === 'string' && (REGIONS as string[]).includes(v)
}

/**
 * Wording for each category, shown in the banner dialog, on /settings and on
 * /cookies so it never drifts. Plain and neutral on purpose — regulators look
 * for non-loaded language.
 */
export const CATEGORY_COPY: Record<ConsentCategory, { label: string; description: string; detail: string }> = {
  necessary: {
    label: 'Strictly necessary',
    description:
      'Sign-in, security, your workspace (chats, projects, drafts) and the display choices you make yourself.',
    detail:
      'These keep you signed in, protect your account, store the chats and projects you work on, and remember settings you choose yourself such as theme and language. They are exempt from consent under the ePrivacy Directive and equivalent rules, because the service cannot work, or cannot do what you asked, without them.',
  },
  functional: {
    label: 'Functional',
    description:
      'Optional conveniences that remember things across visits without you asking. Off by default.',
    detail:
      'Optional storage that makes repeat visits smoother without being needed for what you asked. Nothing in this category is set today; if we add something it will be listed here and stays off until you turn it on.',
  },
  analytics: {
    label: 'Analytics',
    description:
      'Anonymous page-view and performance measurement so we can see what breaks and what is slow. No cookies, never sold.',
    detail:
      'With your consent we load Vercel Web Analytics and Speed Insights. They count page views and measure loading speed without cookies or a persistent identifier, and we strip anything private (sign-in links, invite codes, query strings) from addresses before they are sent. The data is never sold or used for advertising.',
  },
  marketing: {
    label: 'Marketing',
    description:
      'Campaign measurement and advertising on other sites. Not used today; off by default.',
    detail:
      'We do not run advertising or conversion pixels today. If we ever do, they will only load after you opt in here, and Global Privacy Control will always switch them off as an opt-out of sale or sharing.',
  },
}
