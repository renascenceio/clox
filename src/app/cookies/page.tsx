import type { Metadata } from 'next'
import Link from 'next/link'
import CookieSettingsLink from '@/components/cookie-consent/CookieSettingsLink'
import { CATEGORIES, CATEGORY_COPY } from '@/lib/consent/types'
import { entriesFor } from '@/lib/consent/registry'
import LegalShell, { type LegalSection } from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description:
    'What cookies and similar storage Clox uses, what each category does, how long they live, and how to change your consent at any time.',
}

const EFFECTIVE = 'November 2026'

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
    title: 'Everything we store or load',
    body: (
      <>
        <p>
          This list is generated from the same register the cookie banner uses, so it always matches what the site
          actually does. Entries ending in <code>*</code> cover a family of keys (for example one per chat).
        </p>
        {CATEGORIES.map(cat => {
          const rows = entriesFor(cat)
          return (
            <div key={cat} className="mt-6">
              <h3 className="font-serif italic text-[17px] text-ink leading-tight">{CATEGORY_COPY[cat].label}</h3>
              {rows.length ? (
                <ul className="mt-2 m-0 list-none p-0 border border-hairline divide-y divide-hairline-soft">
                  {rows.map(r => (
                    <li key={r.match} className="grid gap-1 px-4 py-3 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,11rem)] md:gap-4">
                      <div className="min-w-0">
                        <div className="break-all font-mono text-[12px] text-ink">{r.match}</div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                          {r.kind} · {r.provider}
                        </div>
                      </div>
                      <div className="text-[13.5px] leading-relaxed text-ink-soft">{r.purpose}</div>
                      <div className="font-mono text-[11px] tracking-[0.02em] text-ink-muted md:text-right">{r.duration}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-ink-muted">Nothing in this category is in use right now.</p>
              )}
            </div>
          )
        })}
      </>
    ),
  },
  {
    id: 'how-consent-works',
    title: 'How your choice is applied',
    body: (
      <ul>
        <li>
          Optional categories are <strong>off until you turn them on</strong>, in every country, including places where
          the law only requires an opt-out.
        </li>
        <li>
          &ldquo;Reject all&rdquo; is as easy as &ldquo;Accept all&rdquo;, and there are no pre-ticked boxes.
        </li>
        <li>
          Your choice is saved on this device (a <code>clox_consent</code> cookie and a local copy) with the date and a
          consent ID you can quote if you contact us. Every page and every open tab follows it immediately.
        </li>
        <li>
          Turning a category off removes what it stored and stops its scripts straight away.
        </li>
        <li>
          We ask again after six months, or sooner if this list changes.
        </li>
        <li>
          The wording you see depends on your country (from your connection, at country or state level only), never
          your controls.
        </li>
      </ul>
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
          Colorado and Connecticut. If your browser sends GPC, we keep everything optional off, don&rsquo;t show the consent
          banner, and marketing can never be switched back on while the signal is present.
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
            here, or from the footer, your account menu, or Settings › Privacy &amp; cookies.
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
