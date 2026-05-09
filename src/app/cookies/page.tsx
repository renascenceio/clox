import type { Metadata } from 'next'
import Link from 'next/link'
import CookieSettingsLink from '@/components/cookie-consent/CookieSettingsLink'
import { CATEGORY_COPY } from '@/lib/consent/types'
import LegalShell, { type LegalSection } from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'What cookies and similar storage Clox uses, what each category does, how long they live, and how to change your consent at any time.',
}

const EFFECTIVE = 'May 2026'

const TABLE: Array<{
  category: keyof typeof CATEGORY_COPY
  examples: string[]
  retention: string
}> = [
  {
    category: 'necessary',
    examples: [
      'sb-* — Supabase auth session',
      'clox_consent — your consent record',
      '__Host-csrf — CSRF protection',
    ],
    retention: 'Session or up to 12 months',
  },
  {
    category: 'functional',
    examples: [
      'clox_theme — pearl / onyx + alternates',
      'clox_locale — language preference',
      'clox_last_model — preferred default model',
    ],
    retention: 'Up to 12 months',
  },
  {
    category: 'analytics',
    examples: [
      'Privacy-respecting page-view counter',
      'Aggregate error sampling',
    ],
    retention: 'Up to 13 months',
  },
  {
    category: 'marketing',
    examples: [
      'Anonymised campaign attribution (only if you opt in)',
      'Conversion pixels for paid ads (only if you opt in)',
    ],
    retention: 'Up to 13 months',
  },
]

const SECTIONS: LegalSection[] = [
  {
    id: 'whats-a-cookie',
    title: 'What we mean by "cookies"',
    body: (
      <p>
        When we say &ldquo;cookies&rdquo; we mean cookies in the strict sense plus other client-side storage like
        localStorage, sessionStorage, and IndexedDB — the same compliance principles apply. Cookies set by{' '}
        <strong>clox.studio</strong> are first-party. Anything set by a service provider (such as Stripe checkout pages)
        is a third-party cookie governed by their own policy.
      </p>
    ),
  },
  {
    id: 'categories',
    title: 'The four categories we use',
    body: (
      <>
        <p>
          Each cookie or similar entry falls into exactly one of these categories. Necessary cookies cannot be turned off
          because the workspace literally won&rsquo;t function without them. Everything else is optional and off until you
          opt in.
        </p>
        <ul>
          {(['necessary', 'functional', 'analytics', 'marketing'] as const).map(cat => {
            const c = CATEGORY_COPY[cat]
            return (
              <li key={cat}>
                <strong>{c.label}.</strong> {c.detail}
              </li>
            )
          })}
        </ul>
      </>
    ),
  },
  {
    id: 'inventory',
    title: 'A current inventory',
    body: (
      <>
        <p>
          The exact list shifts as we ship features, but the table below is accurate as of the effective date and covers
          everything we set on first-party domains.
        </p>
        <div className="mt-4 overflow-x-auto border border-hairline">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-hairline-soft bg-rail-soft">
                <th className="px-4 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">Category</th>
                <th className="px-4 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">Examples</th>
                <th className="px-4 py-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">Retention</th>
              </tr>
            </thead>
            <tbody>
              {TABLE.map(row => (
                <tr key={row.category} className="border-b border-hairline-soft last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <div className="font-serif italic text-[15.5px] text-ink leading-tight">
                      {CATEGORY_COPY[row.category].label}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <ul className="m-0 list-none p-0 font-mono text-[11.5px] tracking-[0.02em] text-ink leading-[1.6]">
                      {row.examples.map(ex => (
                        <li key={ex}>{ex}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-[11.5px] tracking-[0.02em] text-ink-soft">
                    {row.retention}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: 'gpc',
    title: 'GPC and other browser signals',
    body: (
      <>
        <p>
          We honour the <strong>Global Privacy Control</strong> (GPC) signal as a binding opt-out of the &ldquo;sale or
          sharing&rdquo; of personal information under California&rsquo;s CCPA / CPRA and the corresponding rules in
          Colorado and Connecticut. If your browser sends GPC, we set marketing to off automatically and don&rsquo;t show
          the consent banner.
        </p>
        <p>
          We also honour the legacy <strong>Do Not Track</strong> (DNT) header in the same way, even though most browsers
          have moved to GPC.
        </p>
      </>
    ),
  },
  {
    id: 'change-consent',
    title: 'Changing your consent',
    body: (
      <>
        <p>You can change or withdraw your consent at any time:</p>
        <ul>
          <li>
            Click{' '}
            <CookieSettingsLink className="underline decoration-hairline hover:decoration-ink">
              Cookie settings
            </CookieSettingsLink>{' '}
            here, or use the same link in the footer of any page.
          </li>
          <li>
            Clear cookies in your browser&rsquo;s privacy settings — we&rsquo;ll re-prompt the next time you visit.
          </li>
          <li>
            Email{' '}
            <a className="underline decoration-hairline hover:decoration-ink" href="mailto:privacy@clox.studio">
              privacy@clox.studio
            </a>{' '}
            and we&rsquo;ll do it for you.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'related',
    title: 'Related documents',
    body: (
      <ul>
        <li>
          <Link className="underline decoration-hairline hover:decoration-ink" href="/privacy">
            Privacy policy
          </Link>{' '}
          — the broader picture of what data we collect and your rights over it.
        </li>
        <li>
          <Link className="underline decoration-hairline hover:decoration-ink" href="/terms">
            Terms of service
          </Link>{' '}
          — the contract that governs the workspace.
        </li>
      </ul>
    ),
  },
]

export default function CookiesPage() {
  return (
    <LegalShell
      numeral="03"
      eyebrow="legal · cookie policy"
      title={
        <>
          What we store on your device, and{' '}
          <em className="not-italic underline decoration-accent decoration-2 underline-offset-[6px]">
            why
          </em>
          .
        </>
      }
      lead="A plain-language inventory of every cookie and similar local-storage entry Clox uses, grouped by category. You can change your consent at any time from the footer."
      effective={EFFECTIVE}
      sections={SECTIONS}
    />
  )
}
