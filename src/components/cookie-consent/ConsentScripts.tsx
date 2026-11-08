'use client'

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { useConsent } from '@/lib/consent/use-consent'

/** Path segments that carry secrets or personal ids — replaced before anything is sent. */
const PRIVATE_SEGMENTS: [RegExp, string][] = [
  [/\/invite\/[^/?#]+/, '/invite/[token]'],
  [/\/auth\/[^?#]*/, '/auth/[callback]'],
  [/\/preview\/[^/?#]+/, '/preview/[id]'],
  [/\/projects\/[0-9a-f-]{8,}/i, '/projects/[id]'],
  [/\/(text|image|video|audio)\/[0-9a-z_-]{8,}/i, '/$1/[chat]'],
]

/** Drop query strings and hashes (sign-in codes, reset links, search terms) and mask private ids. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url)
    let path = u.pathname
    for (const [re, to] of PRIVATE_SEGMENTS) path = path.replace(re, to)
    return `${u.origin}${path}`
  } catch {
    return url.split(/[?#]/)[0]
  }
}

function beforeSend<T extends { url: string }>(event: T): T {
  return { ...event, url: redactUrl(event.url) }
}

/**
 * Every tracker on the site loads from here and only after the matching
 * consent. Withdrawing consent unmounts them on the spot, in every open tab.
 */
export default function ConsentScripts() {
  const { state } = useConsent()
  if (!state.analytics) return null
  return (
    <>
      <Analytics beforeSend={(e: BeforeSendEvent) => beforeSend(e)} />
      <SpeedInsights beforeSend={(e) => beforeSend(e)} />
    </>
  )
}
