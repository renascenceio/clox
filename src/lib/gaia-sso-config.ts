/** Settings for signing in from Sota OS, safe to use in the middleware. */

export const CRM_ORIGIN = (process.env.GAIA_CRM_URL || 'https://sota.gaiarealty.ae').replace(/\/$/, '')

/** Omma's own address. */
export const OMMA_ORIGIN = 'https://omma.gaiarealty.ae'

/** Old addresses (from when Omma was called Clox) that move to OMMA_ORIGIN. */
export const LEGACY_HOSTS = ['clox.gaiarealty.ae']

/** Addresses where a signed-out visit first checks for a Sota OS session. */
export const AUTO_SSO_HOSTS = ['omma.gaiarealty.ae']

/** Set for a few minutes after each check, so a person who isn't signed in
 *  to Sota OS isn't bounced there on every page (and it never loops). Short
 *  on purpose: signing in to Sota OS later must still sign them in here. */
export const SSO_TRIED_COOKIE = 'clox_sso_tried'
export const SSO_TRIED_SECONDS = 300

/** Set when someone signs out of Omma, so they aren't signed straight back
 *  in from Sota OS. Lasts the browser session; signing in clears it. */
export const SIGNED_OUT_COOKIE = 'omma_signed_out'

/** Call before signing out in the browser. */
export function markSignedOut() {
  if (typeof document !== 'undefined') document.cookie = `${SIGNED_OUT_COOKIE}=1; path=/; samesite=lax; secure`
}

/** Where to send someone to check for (or start) a CRM session. */
export function crmSignInUrl(origin: string, next: string, opts: { prompt?: 'login' } = {}) {
  const url = new URL('/auth/clox', CRM_ORIGIN)
  url.searchParams.set('return', `${origin}/auth/gaia`)
  url.searchParams.set('next', next)
  if (opts.prompt) url.searchParams.set('prompt', opts.prompt)
  return url.toString()
}

/** A path inside Omma, never another site. */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/text'
}
