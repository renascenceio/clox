'use client'

import Link from 'next/link'
import { openPreferences } from '@/lib/consent/store'
import { useConsent } from '@/lib/consent/use-consent'
import { CATEGORIES, CATEGORY_COPY } from '@/lib/consent/types'

/** Current cookie choices + a way to change them, for /settings. */
export default function PrivacyChoices() {
  const { record, state, gpc } = useConsent()
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid grid-cols-1 gap-px border border-hairline-soft bg-hairline-soft sm:grid-cols-2">
        {CATEGORIES.map((c) => (
          <li key={c} className="flex items-center justify-between gap-3 bg-surface px-4 py-3">
            <span className="text-[13.5px] text-ink">{CATEGORY_COPY[c].label}</span>
            <span
              className={`font-mono text-[10.5px] uppercase tracking-[0.1em] ${state[c] ? 'text-ink' : 'text-ink-muted'}`}
            >
              {c === 'necessary' ? 'Always on' : state[c] ? 'On' : 'Off'}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[12.5px] leading-relaxed text-ink-muted">
        {record
          ? `Saved ${new Date(record.decidedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })} · consent ID ${record.id}. We ask again after six months or when our cookie list changes.`
          : 'You have not made a choice on this device yet, so only necessary storage is used.'}
        {gpc ? ' Your browser sends Global Privacy Control, so marketing always stays off.' : ''}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/cookies" className="py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-soft underline-offset-4 hover:text-ink hover:underline">
          Read the cookie policy
        </Link>
        <button
          type="button"
          onClick={openPreferences}
          className="inline-flex min-h-11 items-center justify-center border border-hairline px-5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink hover:bg-rail-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          Change cookie settings
        </button>
      </div>
    </div>
  )
}
