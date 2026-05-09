'use client'

/**
 * /admin/usage — usage & cost forensics.
 *
 * Lets the operator pick a window (7d / 30d / 90d), then renders four
 * panels:
 *   • Spend by day (line/area)
 *   • Spend by provider
 *   • Spend by model
 *   • Latest 200 raw rows
 *
 * Each aggregate is precomputed by /api/admin/usage so the client just
 * renders. Provides an "Export CSV" button that turns the rows into a
 * download in-browser (no extra route needed).
 */

import { useEffect, useMemo, useState } from 'react'
import AdminShell, {
  AdminBtn,
  AdminFilter,
  AdminIconBtn,
  AdminPanel,
} from '@/shared/ui/admin/AdminShell'

interface UsageRow {
  id: string
  user_id: string | null
  provider: string | null
  model: string | null
  prompt_tokens: number | null
  completion_tokens: number | null
  cost_usd: number | null
  domain: string | null
  chat_type: string | null
  created_at: string
}

interface UsageResp {
  rows: UsageRow[]
  aggregates: {
    by_day: Array<{ day: string; spend: number; calls: number; tokens: number }>
    by_provider: Array<{ provider: string; spend: number; calls: number }>
    by_model: Array<{ model: string; spend: number; calls: number }>
    by_chat_type: Array<{ chat_type: string; spend: number; calls: number }>
  }
}

const WINDOW_OPTIONS = [
  { key: '7d', days: 7, label: 'last 7 days' },
  { key: '30d', days: 30, label: 'last 30 days' },
  { key: '90d', days: 90, label: 'last 90 days' },
] as const

export default function UsagePage() {
  const [windowKey, setWindowKey] = useState<'7d' | '30d' | '90d'>('30d')
  const [data, setData] = useState<UsageResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const days = WINDOW_OPTIONS.find(w => w.key === windowKey)!.days
    fetch(`/api/admin/usage?days=${days}&limit=500`, { cache: 'no-store' })
      .then(r => r.json())
      .then((j: UsageResp) => { if (!cancelled) setData(j) })
      .catch(e => console.error('[v0] /admin/usage fetch failed', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [windowKey, tick])

  const totals = useMemo(() => {
    if (!data) return { spend: 0, calls: 0, tokens: 0 }
    const { by_day } = data.aggregates
    return {
      spend: by_day.reduce((s, d) => s + d.spend, 0),
      calls: by_day.reduce((s, d) => s + d.calls, 0),
      tokens: by_day.reduce((s, d) => s + d.tokens, 0),
    }
  }, [data])

  return (
    <AdminShell
      crumb={['admin', 'overview']}
      here="Usage & cost"
      eyebrow={`platform-wide · ${WINDOW_OPTIONS.find(w => w.key === windowKey)?.label}`}
      heading={<>Where the dollars <em className="italic">went.</em></>}
      lead="Spend by day, by provider, by model. Same numbers as your Stripe ledger, but sliced for forensics — drill into a model or a date to see exactly which calls drove the bill."
      headExtra={WINDOW_OPTIONS.map(w => (
        <AdminFilter key={w.key} active={windowKey === w.key} onClick={() => setWindowKey(w.key)}>
          {w.label}
        </AdminFilter>
      ))}
      syncHint={loading ? 'syncing…' : `${data?.rows.length ?? 0} rows`}
      actions={
        <>
          <AdminIconBtn title="Refresh" onClick={() => setTick(t => t + 1)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M11 6.5a4.5 4.5 0 1 1-1.32-3.18M11 1.5v3H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </AdminIconBtn>
          <AdminBtn onClick={() => exportCsv(data?.rows ?? [])}>Export CSV</AdminBtn>
        </>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-3 border border-hairline rounded-card bg-surface mb-[18px]">
        <KpiCell label="Spend" value={`$${totals.spend.toFixed(2)}`} accent />
        <KpiCell label="Calls" value={totals.calls.toLocaleString()} />
        <KpiCell label="Tokens" value={formatCount(totals.tokens)} />
      </div>

      {/* Spend by day */}
      <AdminPanel title="Spend per day" meta="USD" className="mb-[18px]">
        <SpendByDayChart days={data?.aggregates.by_day ?? []} loading={loading} />
      </AdminPanel>

      {/* Two side panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-[18px] mb-[18px]">
        <AdminPanel title="By provider" meta={`${data?.aggregates.by_provider.length ?? 0} providers`}>
          <BarList rows={(data?.aggregates.by_provider ?? []).map(p => ({ key: p.provider, spend: p.spend, calls: p.calls }))} />
        </AdminPanel>
        <AdminPanel title="By model" meta={`${data?.aggregates.by_model.length ?? 0} models`}>
          <BarList rows={(data?.aggregates.by_model ?? []).map(m => ({ key: m.model, spend: m.spend, calls: m.calls }))} />
        </AdminPanel>
      </div>

      {/* Raw rows */}
      <AdminPanel title="Raw events" meta={`latest ${data?.rows.length ?? 0}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr>
                {['When', 'Provider', 'Model', 'Type', 'Tokens', 'Cost'].map((h, i) => (
                  <th key={i} className={`text-left font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted font-normal px-4 py-3 border-b border-hairline bg-rail-soft ${
                    h === 'Tokens' || h === 'Cost' ? 'text-right' : ''
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center font-mono text-[11px] text-ink-muted">loading…</td></tr>
              ) : (data?.rows.length ?? 0) === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center font-mono text-[11px] text-ink-muted">no events yet — run a chat to see entries</td></tr>
              ) : data!.rows.map(r => (
                <tr key={r.id} className="hover:bg-rail-soft">
                  <td className="px-4 py-2.5 border-b border-hairline-soft font-mono text-[11px] text-ink-muted">{shortTime(r.created_at)}</td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft font-mono text-[11px]">{r.provider ?? '—'}</td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft font-mono text-[11px] truncate max-w-[260px]" title={r.model ?? ''}>{r.model ?? '—'}</td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft"><span className="inline-block font-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 border border-hairline-soft rounded-sharp">{r.chat_type ?? 'chat'}</span></td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft text-right font-mono text-[11px]">{formatCount((r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0))}</td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft text-right font-mono text-[11px] text-ink">${Number(r.cost_usd ?? 0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </AdminShell>
  )
}

/* ----------------------------------------------------------------- */

function KpiCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-5 py-[18px] border-r border-hairline-soft last:border-r-0">
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">{label}</div>
      <div className={`font-serif text-[34px] leading-none tracking-[-0.02em] mt-1.5 ${accent ? 'italic text-accent' : ''}`}>{value}</div>
    </div>
  )
}

function SpendByDayChart({
  days,
  loading,
}: {
  days: Array<{ day: string; spend: number; calls: number; tokens: number }>
  loading: boolean
}) {
  if (loading) return <div className="px-[18px] py-12 text-center font-mono text-[11px] text-ink-muted">loading…</div>
  if (!days.length) return <div className="px-[18px] py-12 text-center font-mono text-[11px] text-ink-muted">no spend in this window</div>

  const W = 720, H = 220, PAD_L = 36, PAD_R = 14, PAD_T = 16, PAD_B = 28
  const max = Math.max(0.01, ...days.map(d => d.spend)) * 1.15
  const x = (i: number) => PAD_L + ((W - PAD_L - PAD_R) * i) / Math.max(1, days.length - 1)
  const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / max)

  let svg = ''
  for (let g = 0; g <= 4; g++) {
    const yy = PAD_T + ((H - PAD_T - PAD_B) * g) / 4
    const v = max * (1 - g / 4)
    svg += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${yy}" y2="${yy}" stroke="rgba(24,24,26,0.07)" stroke-width="1"/>`
    svg += `<text x="${PAD_L - 8}" y="${yy + 3}" text-anchor="end" font-family="Geist Mono, monospace" font-size="9" fill="#8E8C86">$${v < 1 ? v.toFixed(2) : v.toFixed(0)}</text>`
  }
  const stride = Math.max(1, Math.ceil(days.length / 6))
  days.forEach((d, i) => {
    if (i % stride !== 0 && i !== days.length - 1) return
    const dt = new Date(d.day)
    const lbl = isNaN(dt.getTime()) ? d.day : `${dt.getMonth() + 1}/${dt.getDate()}`
    svg += `<text x="${x(i)}" y="${H - PAD_B + 16}" text-anchor="middle" font-family="Geist Mono, monospace" font-size="9" fill="#8E8C86">${lbl}</text>`
  })
  // Filled area + line.
  let area = `M${x(0)},${y(0)} `
  days.forEach((d, i) => area += `L${x(i)},${y(d.spend)} `)
  area += `L${x(days.length - 1)},${y(0)} Z`
  svg += `<path d="${area}" fill="rgba(168,71,42,0.10)"/>`
  let line = ''
  days.forEach((d, i) => line += `${i ? 'L' : 'M'}${x(i)},${y(d.spend)} `)
  svg += `<path d="${line}" fill="none" stroke="#A8472A" stroke-width="1.4"/>`
  // Endpoint dot.
  const last = days[days.length - 1]
  svg += `<circle cx="${x(days.length - 1)}" cy="${y(last.spend)}" r="3" fill="#FAF9F4" stroke="#A8472A" stroke-width="1.4"/>`

  return (
    <div className="p-[18px]">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="Spend per day" />
    </div>
  )
}

function BarList({ rows }: { rows: Array<{ key: string | null; spend: number; calls: number }> }) {
  if (!rows.length) return <div className="px-[18px] py-10 text-center font-mono text-[11px] text-ink-muted">no data</div>
  const max = Math.max(0.01, ...rows.map(r => r.spend))
  return (
    <div>
      {rows.slice(0, 8).map((r, i) => (
        <div key={r.key ?? `r${i}`} className={`grid grid-cols-[28px_1fr_auto_auto] gap-3 items-center px-[18px] py-3 ${i === Math.min(rows.length, 8) - 1 ? '' : 'border-b border-hairline-soft'}`}>
          <div className="font-mono text-[10px] text-ink-muted tracking-[0.08em]">0{i + 1}</div>
          <div className="min-w-0">
            <div className="font-serif italic text-[15px] truncate">{r.key || 'unknown'}</div>
            <div className="font-mono text-[10px] text-ink-muted tracking-[0.04em] mt-0.5">{r.calls} calls</div>
          </div>
          <div className="w-[120px] h-1.5 bg-surface-alt rounded-[1px] overflow-hidden relative">
            <div className={`absolute left-0 top-0 bottom-0 ${i === 0 ? 'bg-accent' : 'bg-ink'}`} style={{ width: `${(r.spend / max) * 100}%` }} />
          </div>
          <div className="font-mono text-[11px] text-ink w-[64px] text-right">${r.spend.toFixed(2)}</div>
        </div>
      ))}
    </div>
  )
}

function exportCsv(rows: UsageRow[]) {
  const head = ['created_at', 'provider', 'model', 'chat_type', 'prompt_tokens', 'completion_tokens', 'cost_usd', 'domain', 'user_id']
  const csv = [head.join(',')]
  for (const r of rows) {
    csv.push([
      r.created_at,
      escape(r.provider),
      escape(r.model),
      escape(r.chat_type),
      r.prompt_tokens ?? 0,
      r.completion_tokens ?? 0,
      Number(r.cost_usd ?? 0).toFixed(6),
      escape(r.domain),
      escape(r.user_id),
    ].join(','))
  }
  const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `usage-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
function escape(v: string | null | undefined): string {
  if (v == null) return ''
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}
function shortTime(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.toISOString().slice(5, 10)} ${d.toTimeString().slice(0, 5)}`
  } catch { return '—' }
}
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
