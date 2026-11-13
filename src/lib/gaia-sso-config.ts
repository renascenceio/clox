/** Settings for signing in from Gaia CRM, safe to use in the middleware. */

export const CRM_ORIGIN = (process.env.GAIA_CRM_URL || 'https://crm.gaiarealty.ae').replace(/\/$/, '')

/** Addresses where a signed-out visit first checks for a CRM session. */
export const AUTO_SSO_HOSTS = ['clox.gaiarealty.ae']

/** Set once per browser session, so the check runs once and never loops
 *  (and someone who signs out isn't signed straight back in). */
export const SSO_TRIED_COOKIE = 'clox_sso_tried'

/** Where to send someone to check for (or start) a CRM session. */
export function crmSignInUrl(origin: string, next: string, opts: { prompt?: 'login' } = {}) {
  const url = new URL('/auth/clox', CRM_ORIGIN)
  url.searchParams.set('return', `${origin}/auth/gaia`)
  url.searchParams.set('next', next)
  if (opts.prompt) url.searchParams.set('prompt', opts.prompt)
  return url.toString()
}

/** A path inside Clox, never another site. */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/text'
}
