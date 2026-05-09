'use client'

/**
 * /admin/status — operational health.
 *
 * The platform doesn't yet record latency or per-call errors, so this page
 * shows what we *can* honestly report:
 *   • Aggregate signals (active users, calls, spend, MRR) over 30d.
 *   • Per-provider 24h call counts + cost (from /api/admin/dashboard).
 *   • A "what's coming" panel that names the missing telemetry so an
 *     operator isn't left wondering why there are no red bars.
 */

import { useEffect, useState } from 'react'
import AdminShell, {
  AdminIconBtn,
  AdminPanel,
} from '@/shared/ui/admin/AdminShell'

interface Dashboard {
  kpis: {
    total_users: number
    active_users_30d: number
    spend_30d_usd: number
    calls_30d: number
    mrr_usd: number
  }
  providers_24h: Array<{ provider: string; calls_24h: number; cost_24h: number }>
}

export default function StatusPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/dashboard', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: Dashboard) => { if (!cancelled) setData(j) })
      .catch(e => console.error('[v0] /admin/status fetch failed', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tick])

  const allOk = (data?.providers_24h ?? []).every(p => p.calls_24h > 0)

  return (
    <AdminShell
      crumb={['admin', 'overview']}
      here="System status"
      eyebrow={`platform · ${loading ? 'syncing…' : allOk ? 'all systems nominal' : 'mixed signals'}`}
      heading={<>Posture &amp; <em className="italic">heartbeat.</em></>}
      lead="The honest version: we report what we measure. Aggregate platform signals from the last 30 days, plus per-provider activity from the last 24 hours."
      syncHint={loading ? 'syncing…' : 'live · auto-refresh on demand'}
      actions={
        <AdminIconBtn title="Refresh" onClick={() => setTick(t => t + 1)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5a4.5 4.5 0 1 1-1.32-3.18M11 1.5v3H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </AdminIconBtn>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 border border-hairline rounded-card bg-surface mb-[18px]">
        <KpiCell label="Active users (30d)" value={(data?.kpis.active_users_30d ?? 0).toLocaleString()} />
        <KpiCell label="Calls (30d)" value={(data?.kpis.calls_30d ?? 0).toLocaleString()} />
        <KpiCell label="Spend (30d)" value={`$${(data?.kpis.spend_30d_usd ?? 0).toFixed(2)}`} accent />
        <KpiCell label="MRR" value={`$${(data?.kpis.mrr_usd ?? 0).toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-[18px]">
        <AdminPanel title="Providers · last 24h" meta={`${data?.providers_24h.length ?? 0} providers`}>
          {loading ? (
            <div className="px-[18px] py-10 text-center font-mono text-[11px] text-ink-muted">loading…</div>
          ) : (data?.providers_24h.length ?? 0) === 0 ? (
            <div className="px-[18px] py-10 text-center font-mono text-[11px] text-ink-muted">no provider activity in 24h</div>
          ) : (
            data!.providers_24h.map((p, idx) => (
              <div key={p.provider} className={`grid grid-cols-[16px_1fr_auto_auto] gap-3 items-center px-[18px] py-3 ${idx === data!.providers_24h.length - 1 ? '' : 'border-b border-hairline-soft'}`}>
                <StatusDot tone={p.calls_24h > 0 ? 'green' : 'idle'} />
                <div className="min-w-0">
                  <div className="font-serif italic text-[15px] truncate">{p.provider}</div>
                  <div className="font-mono text-[10px] text-ink-muted">{p.calls_24h > 0 ? 'serving traffic' : 'idle'}</div>
                </div>
                <span className="font-mono text-[11px] text-ink-soft">{p.calls_24h} calls</span>
                <span className="font-mono text-[11px] text-ink">${p.cost_24h.toFixed(2)}</span>
              </div>
            ))
          )}
        </AdminPanel>

        <AdminPanel title="Telemetry roadmap" meta="not yet wired">
          <div className="px-[18px] py-3.5 space-y-3.5 text-[13px]">
            <Note title="Per-call latency">
              Will land alongside the next chat-router refactor. We&apos;ll capture provider-side ms and surface a P50 / P99 line on the spend chart.
            </Note>
            <Note title="Error rate by provider">
              Today errors halt the request without logging a usage row. Plan: extend <code className="font-mono text-[11.5px] bg-surface-alt px-1.5 py-0.5 rounded-sharp text-accent">usage_logs</code> with a <code className="font-mono text-[11.5px] bg-surface-alt px-1.5 py-0.5 rounded-sharp text-accent">status</code> column.
            </Note>
            <Note title="Real uptime histogram">
              Once we run synthetic probes from a worker, this panel will show the last-32-bucket uptime stripe used in the rail mock.
            </Note>
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  )
}

function KpiCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-5 py-[18px] border-r border-hairline-soft last:border-r-0">
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">{label}</div>
      <div className={`font-serif text-[28px] leading-none tracking-[-0.02em] mt-1.5 ${accent ? 'italic text-accent' : ''}`}>{value}</div>
    </div>
  )
}

function StatusDot({ tone }: { tone: 'green' | 'amber' | 'red' | 'idle' }) {
  const map = {
    green: { bg: 'rgb(47 143 95)',  ring: 'rgba(47,143,95,0.12)' },
    amber: { bg: 'rgb(185 138 43)', ring: 'rgba(185,138,43,0.12)' },
    red:   { bg: 'rgb(181 58 40)',  ring: 'rgba(181,58,40,0.12)' },
    idle:  { bg: 'rgb(142 140 134)', ring: 'rgba(142,140,134,0.12)' },
  } as const
  const { bg, ring } = map[tone]
  return <span className="inline-block w-[7px] h-[7px] rounded-full" style={{ background: bg, boxShadow: `0 0 0 4px ${ring}` }} aria-hidden />
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-serif italic text-[15px]">{title}</div>
      <div className="text-[12.5px] text-ink-soft leading-relaxed mt-0.5">{children}</div>
    </div>
  )
}
