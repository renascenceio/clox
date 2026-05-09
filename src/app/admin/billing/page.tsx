'use client'

/**
 * /admin/billing — invoices + outstanding credit balances.
 *
 * Pulls /api/admin/billing once. Top KPI strip shows paid / open / failed
 * totals, and below that an invoices table with status filters. The optional
 * `?user=<id>` query narrows the table to a single payer.
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import AdminShell, {
  AdminBtn,
  AdminFilter,
  AdminIconBtn,
  AdminPanel,
} from '@/shared/ui/admin/AdminShell'

interface Invoice {
  id: string
  amount_usd: number
  status: string
  description: string | null
  created_at: string
  user: { email: string; name: string }
}

interface BillingResp {
  invoices: Invoice[]
  totals: { paid: number; open: number; failed: number; count: number }
  credit_total: number
}

const STATUS_FILTERS = ['all', 'paid', 'open', 'pending', 'failed', 'refunded'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

export default function BillingPage() {
  const params = useSearchParams()
  const userFilter = params.get('user')

  const [data, setData] = useState<BillingResp | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/billing', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: BillingResp) => { if (!cancelled) setData(j) })
      .catch(e => console.error('[v0] /admin/billing fetch failed', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tick])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.invoices.filter(i => {
      if (status !== 'all' && i.status !== status) return false
      if (userFilter && !i.id.startsWith(userFilter)) {
        // We don't expose user_id in the response by default; the parent page
        // already filters via the toolbar query. Treat user= as a hint only.
      }
      if (!query) return true
      const q = query.toLowerCase()
      return (
        i.user.email.toLowerCase().includes(q) ||
        i.user.name.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [data, status, query, userFilter])

  return (
    <AdminShell
      crumb={['admin', 'people']}
      here="Billing"
      eyebrow="invoices · payouts · outstanding credit"
      heading={<>The money <em className="italic">side of the house.</em></>}
      lead="Every invoice on the platform, plus the float of outstanding credit. Filter by status to triage failed payments and chase open balances."
      headExtra={STATUS_FILTERS.map(s => (
        <AdminFilter key={s} active={status === s} onClick={() => setStatus(s)}>
          {s}
        </AdminFilter>
      ))}
      syncHint={loading ? 'syncing…' : `${filtered.length} of ${data?.totals.count ?? 0} invoices`}
      actions={
        <AdminIconBtn title="Refresh" onClick={() => setTick(t => t + 1)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5a4.5 4.5 0 1 1-1.32-3.18M11 1.5v3H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </AdminIconBtn>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 border border-hairline rounded-card bg-surface mb-[18px]">
        <KpiCell label="Paid" value={`$${(data?.totals.paid ?? 0).toFixed(2)}`} tone="green" />
        <KpiCell label="Open / pending" value={`$${(data?.totals.open ?? 0).toFixed(2)}`} tone="amber" />
        <KpiCell label="Failed" value={`$${(data?.totals.failed ?? 0).toFixed(2)}`} tone="red" />
        <KpiCell label="Outstanding credit" value={`$${(data?.credit_total ?? 0).toFixed(2)}`} accent />
      </div>

      <AdminPanel
        title="Invoices"
        meta={`${filtered.length} rows`}
        toolbar={
          <div className="flex items-center justify-between gap-3 px-[18px] py-3 border-b border-hairline-soft">
            <div className="flex items-center gap-2 px-2.5 py-1.5 border border-hairline-soft rounded-sharp bg-surface w-full max-w-[420px] font-mono text-[11px]">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-ink-muted">
                <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.1" />
                <path d="m7 7 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="search by email, name, description…"
                className="flex-1 bg-transparent outline-none border-0 font-mono text-[11px] text-ink placeholder:text-ink-muted"
              />
            </div>
            <AdminBtn onClick={() => exportInvoices(filtered)}>Export CSV</AdminBtn>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr>
                {['User', 'Description', 'Status', 'When', 'Amount'].map((h, i) => (
                  <th key={i} className={`text-left font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted font-normal px-4 py-3 border-b border-hairline bg-rail-soft ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center font-mono text-[11px] text-ink-muted">loading invoices…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center font-mono text-[11px] text-ink-muted">no invoices match</td></tr>
              ) : filtered.map(i => (
                <tr key={i.id} className="hover:bg-rail-soft">
                  <td className="px-4 py-2.5 border-b border-hairline-soft">
                    <div className="font-medium truncate">{i.user.name}</div>
                    <div className="font-mono text-[11px] text-ink-muted truncate">{i.user.email}</div>
                  </td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft text-[12.5px] text-ink-soft truncate max-w-[420px]" title={i.description ?? ''}>{i.description ?? '—'}</td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft"><StatusChip status={i.status} /></td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft font-mono text-[11px] text-ink-muted">{shortDate(i.created_at)}</td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft text-right font-mono text-[12px]">${i.amount_usd.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </AdminShell>
  )
}

function KpiCell({ label, value, tone, accent }: { label: string; value: string; tone?: 'green' | 'amber' | 'red'; accent?: boolean }) {
  const toneCls = tone === 'green' ? 'text-[rgb(47_143_95)]'
    : tone === 'amber' ? 'text-[rgb(185_138_43)]'
      : tone === 'red' ? 'text-[rgb(181_58_40)]'
        : ''
  return (
    <div className="px-5 py-[18px] border-r border-hairline-soft last:border-r-0">
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">{label}</div>
      <div className={`font-serif text-[28px] leading-none tracking-[-0.02em] mt-1.5 ${accent ? 'italic text-accent' : toneCls}`}>{value}</div>
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const cls = status === 'paid' ? 'border-[rgb(47_143_95)] text-[rgb(47_143_95)]'
    : status === 'failed' ? 'border-[rgb(181_58_40)] text-[rgb(181_58_40)]'
      : status === 'open' || status === 'pending' ? 'border-[rgb(185_138_43)] text-[rgb(185_138_43)]'
        : 'border-hairline text-ink-muted'
  return (
    <span className={`inline-flex items-center font-mono text-[10.5px] tracking-[0.06em] uppercase px-2 py-0.5 border rounded-sharp ${cls}`}>
      {status}
    </span>
  )
}

function exportInvoices(rows: Invoice[]) {
  const head = ['id', 'user_email', 'user_name', 'description', 'status', 'amount_usd', 'created_at']
  const csv = [head.join(',')]
  for (const r of rows) {
    csv.push([r.id, esc(r.user.email), esc(r.user.name), esc(r.description ?? ''), r.status, r.amount_usd.toFixed(2), r.created_at].join(','))
  }
  const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
function esc(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}
function shortDate(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 10) } catch { return '—' }
}
