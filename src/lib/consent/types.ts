/**
 * Cookie / tracking consent — shared shape used by the banner, the customize
 * sheet, the public `getConsent()` helper, and any future analytics loaders.
 *
 * The four categories below intentionally mirror the IAB TCF / EDPB
 * "necessary | functional | analytics | marketing" split so a single state
 * shape covers GDPR (EEA + UK), Swiss DPA, LGPD (BR), POPIA (ZA), PIPL (CN
 * Hong Kong), Quebec Law 25, and the US state laws (CCPA/CPRA + the dozen
 * "comprehensive" sister statutes — VA, CO, CT, UT, etc.).
 *
 * "necessary" is always granted — it covers strictly-necessary cookies the
 * ePrivacy Directive carves out (session, CSRF, auth). Every other category
 * is opt-in everywhere except the US, where opt-out is sufficient; we treat
 * GPC / DNT signals as an opt-out for marketing + analytics regardless of
 * region.
 */
export type ConsentCategory = 'necessary' | 'functional' | 'analytics' | 'marketing'

export interface ConsentState {
  necessary: true
  functional: boolean
  analytics: boolean
  marketing: boolean
}

/**
 * Persisted record. We track:
 *   - the consent values themselves
 *   - the policy version at the moment of consent (so a policy update can
 *     re-prompt without losing prior history)
 *   - the time of the last decision (audit trail; some regulators ask for
 *     this)
 *   - the inferred region (used to decide *which* prompt copy to show, never
 *     to pre-fill consent)
 *   - the originating method ("accept-all" | "reject-all" | "custom" |
 *     "gpc" | "dnt") for the same audit reason.
 */
export interface ConsentRecord {
  state: ConsentState
  version: number
  decidedAt: string
  method: 'accept-all' | 'reject-all' | 'custom' | 'gpc' | 'dnt'
  region: ConsentRegion
}

/**
 * Coarse region buckets. These are *display* hints only — we never block any
 * jurisdiction from getting full granular controls. Keeping the buckets coarse
 * avoids leaking IP-based geolocation onto the page render path.
 */
export type ConsentRegion =
  | 'eea'   // GDPR + ePrivacy
  | 'uk'    // UK GDPR + PECR
  | 'ch'    // Swiss revFADP
  | 'us-ca' // CCPA / CPRA — opt-out
  | 'us'    // other US states + federal default
  | 'br'    // LGPD
  | 'ca-qc' // Quebec Law 25
  | 'global'

export const CONSENT_VERSION = 1
export const CONSENT_STORAGE_KEY = 'clox.consent.v1'

/**
 * Plain-language descriptions of each category, surfaced both in the
 * customize sheet (CookieConsent) and on the public /cookies policy page so
 * the wording stays in sync. Keep these short, neutral, and free of marketing
 * — regulators specifically look for clear, non-loaded language.
 */
/**
 * `description` is the short blurb shown on the banner / customize sheet.
 * `detail` is a slightly longer plain-English version surfaced on the public
 * /cookies policy page. Keeping both in one place stops the wordings from
 * drifting apart.
 */
export const CATEGORY_COPY: Record<
  ConsentCategory,
  { label: string; description: string; detail: string }
> = {
  necessary: {
    label: 'Strictly necessary',
    description:
      'Authentication, session integrity, CSRF protection, and security signals. Always on — the site cannot function without these.',
    detail:
      'These cookies keep you signed in, prevent cross-site request forgery, and let core features like saving and routing work. They are exempt from consent under the ePrivacy Directive and equivalent rules elsewhere.',
  },
  functional: {
    label: 'Functional',
    description:
      'Remembers your preferences (theme, sidebar collapse state, language). Off by default; enable for a smoother experience across visits.',
    detail:
      'These cookies remember choices you make so you do not have to repeat them. They are not used for tracking, analytics, or advertising.',
  },
  analytics: {
    label: 'Analytics',
    description:
      'Aggregated, pseudonymised usage statistics so we can see which features get used and where things break. We do not sell or share this data.',
    detail:
      'We use first-party analytics to understand which features get used, surface broken flows, and improve performance. The data is aggregated and pseudonymised; we do not sell or share it with third parties for their own purposes.',
  },
  marketing: {
    label: 'Marketing',
    description:
      'Measures the effectiveness of our campaigns and, where applicable, shows relevant ads on third-party sites. Off by default.',
    detail:
      'These cookies measure the effectiveness of our marketing campaigns and, where applicable, allow third parties to show you relevant ads off our site. They are off by default and require your explicit opt-in.',
  },
}
