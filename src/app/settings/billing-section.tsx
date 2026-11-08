'use client'

import { useEffect, useState } from 'react'
import type { Palette } from '@/shared/ui/chat/palettes'
import { CREDIT_PACKS, PLANS, formatCredits, planFor, type BillingCycle } from '@/lib/plans'

interface Billing {
  plan: string
  unlimited: boolean
  credits: { plan: number; carry: number; topup: number; total: number }
  periodEnd: string | null
  used: number
  usedToday: number
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function BillingSection({ p, mono, serif }: { p: Palette; mono: string; serif: string }) {
  const [data, setData] = useState<Billing | null>(null)
  const [failed, setFailed] = useState(false)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')

  useEffect(() => {
    let live = true
    fetch('/api/billing', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(j => { if (live) setData(j) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  const label: React.CSSProperties = { fontFamily: mono, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: p.inkMuted }

  if (failed) return <p style={{ fontSize: 13, color: p.inkSoft, margin: 0 }}>Couldn’t load your plan. Reload the page to try again.</p>
  if (!data) return <p style={{ ...label, margin: 0 }}>loading plan…</p>

  const current = planFor(data.plan)
  const monthlyLeft = data.credits.plan + data.credits.carry
  const shareLeft = current.credits > 0 ? Math.min(1, monthlyLeft / current.credits) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Balance */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={label}>{current.name} plan</div>
          <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 34, lineHeight: 1.05, color: p.ink, marginTop: 4 }}>
            {data.unlimited ? 'Unlimited' : `${formatCredits(data.credits.total)} credits`}
          </div>
          {!data.unlimited && data.periodEnd && (
            <div style={{ fontSize: 12.5, color: p.inkSoft, marginTop: 6 }}>
              {formatCredits(current.credits)} new credits on {day(data.periodEnd)}
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto)', gap: '4px 22px', textAlign: 'right' }}>
          {[
            ['This month', data.credits.plan],
            ['Carried over', data.credits.carry],
            ['Bought', data.credits.topup],
          ].map(([k, v]) => (
            <div key={k as string}>
              <div style={label}>{k}</div>
              <div style={{ fontFamily: mono, fontSize: 14, color: p.ink, marginTop: 3 }}>{formatCredits(v as number)}</div>
            </div>
          ))}
        </div>
      </div>

      {!data.unlimited && (
        <div>
          <div
            role="progressbar"
            aria-label="Monthly credits left"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shareLeft * 100)}
            style={{ height: 6, background: p.hairlineSoft, borderRadius: 3, overflow: 'hidden' }}
          >
            <div style={{ width: `${shareLeft * 100}%`, height: '100%', background: shareLeft < 0.2 ? p.accent : p.ink }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: p.inkMuted }}>
            <span>{formatCredits(data.used)} used this period</span>
            {current.dailyCap
              ? <span>{formatCredits(data.usedToday)} of {current.dailyCap} today</span>
              : <span>Unused monthly credits carry over one month</span>}
          </div>
        </div>
      )}

      {/* Plans */}
      <div style={{ borderTop: `1px solid ${p.hairlineSoft}`, paddingTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={label}>Plans</div>
          <div role="group" aria-label="Billing cycle" style={{ display: 'inline-flex', border: `1px solid ${p.hairline}`, borderRadius: 3, overflow: 'hidden' }}>
            {(['monthly', 'yearly'] as const).map(c => (
              <button
                key={c}
                type="button"
                aria-pressed={cycle === c}
                onClick={() => setCycle(c)}
                style={{
                  fontFamily: mono, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase',
                  padding: '6px 12px', border: 'none', cursor: 'pointer',
                  background: cycle === c ? p.ink : 'transparent', color: cycle === c ? p.bg : p.inkSoft,
                }}
              >
                {c === 'monthly' ? 'Monthly' : 'Yearly · 2 months free'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {Object.values(PLANS).map(plan => {
            const isCurrent = plan.id === current.id
            const price = cycle === 'monthly' ? plan.monthly : plan.yearly
            return (
              <div
                key={plan.id}
                style={{
                  border: `1px solid ${isCurrent ? p.ink : p.hairline}`,
                  borderRadius: 3, padding: '14px 14px 16px',
                  display: 'flex', flexDirection: 'column', gap: 8,
                  background: isCurrent ? p.surfaceAlt : 'transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 20, color: p.ink }}>{plan.name}</span>
                  {isCurrent && <span style={{ ...label, fontSize: 9, color: p.accent }}>Current</span>}
                </div>
                <div style={{ fontFamily: mono, fontSize: 13, color: p.ink }}>
                  {price === 0 ? 'Free' : `$${price}`}
                  {price > 0 && <span style={{ color: p.inkMuted }}>{cycle === 'monthly' ? ' / month' : ' / year'}</span>}
                </div>
                <div style={{ fontSize: 12, color: p.inkSoft, lineHeight: 1.45 }}>{plan.blurb}</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: p.inkSoft, lineHeight: 1.5 }}>
                  {plan.features.map(f => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )
          })}
        </div>
      </div>

      {/* Credit packs */}
      <div style={{ borderTop: `1px solid ${p.hairlineSoft}`, paddingTop: 18 }}>
        <div style={{ ...label, marginBottom: 10 }}>Credit packs · never expire</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {CREDIT_PACKS.map(pack => (
            <div key={pack.id} style={{ border: `1px solid ${p.hairline}`, borderRadius: 3, padding: '10px 14px', fontSize: 12.5, color: p.ink }}>
              <span style={{ fontFamily: mono }}>${pack.price}</span>
              <span style={{ color: p.inkMuted }}> · {formatCredits(pack.credits)} credits</span>
            </div>
          ))}
        </div>
      </div>

      <p style={{
        margin: 0, fontSize: 12.5, lineHeight: 1.55, color: p.inkSoft,
        background: p.surfaceAlt, border: `1px solid ${p.hairline}`, borderLeft: `3px solid ${p.accent}`,
        borderRadius: 3, padding: '10px 14px',
      }}>
        Online payments aren’t switched on yet. To change plan or add credits, ask a Clox admin — it takes effect straight away.
        One credit is a tenth of a cent of model cost at the provider’s real price, so a short Auto reply uses a few credits
        and a long document build a few hundred.
      </p>
    </div>
  )
}
