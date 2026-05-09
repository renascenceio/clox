'use client'

import { useEffect, useState, useCallback } from 'react'
import type { ProjectFull } from '../_types'

/**
 * The API returns aggregates keyed by `spend` and entries keyed by `cost_usd`.
 * Mirrors that shape exactly so we don't double-translate.
 */
type UsageEntry = {
  id: string
  user_id: string | null
  member_email: string | null
  model: string | null
  modality: string | null
  cost_usd: number
  prompt_tokens: number | null
  completion_tokens: number | null
  chat_id: string | null
  created_at: string
}
type UsageResponse = {
  entries: UsageEntry[]
  by_day: { day: string; spend: number; calls: number }[]
  by_member: { user_id: string; email: string | null; spend: number; calls: number }[]
  by_model: { model: string; spend: number; calls: number }[]
  by_modality: { modality: string; spend: number; calls: number }[]
}

export default function UsageTab({ project }: { project: ProjectFull }) {
  const [data, setData] = useState<UsageResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  const load = useCallback(async () => {
    try {
      const since = (() => {
        if (range === 'all') return null
        const d = new Date()
        d.setDate(d.getDate() - (range === '7d' ? 7 : range === '30d' ? 30 : 90))
        return d.toISOString().slice(0, 10)
      })()
      const url = `/api/projects/${project.id}/usage?limit=500${since ? `&since=${since}` : ''}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e) { setError((e as Error).message) }
  }, [project.id, range])

  useEffect(() => { load() }, [load])

  function exportCsv() {
    if (!data?.entries.length) return
    const header = ['date', 'user', 'model', 'modality', 'prompt_tokens', 'completion_tokens', 'cost_usd', 'chat_id']
    const rows = data.entries.map(e => [
      new Date(e.created_at).toISOString(),
      e.member_email ?? '—',
      e.model ?? '—',
      e.modality ?? '—',
      e.prompt_tokens ?? '',
      e.completion_tokens ?? '',
      e.cost_usd.toFixed(4),
      e.chat_id ?? '',
    ])
    const csv = [header, ...rows].map(r =>
      r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.title}-usage-${range}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-hairline pb-3 mb-5">
        <div>
          <div className="font-mono text-[10.5px] tracking-[0.1em] uppercase text-ink-muted">
            usage
          </div>
          <h2 className="font-serif italic text-[26px] text-ink leading-tight mt-1">
            Where the credit went.
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-mono text-[10px] tracking-[0.06em] uppercase">
            {(['7d', '30d', '90d', 'all'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-2.5 py-1 transition-colors ${
                  range === r ? 'text-ink border-b border-ink' : 'text-ink-muted hover:text-ink-soft'
                }`}
              >{r}</button>
            ))}
          </div>
          <button
            onClick={exportCsv}
            disabled={!data?.entries.length}
            className="font-mono text-[10px] tracking-[0.08em] uppercase text-ink-soft hover:text-ink transition-colors disabled:opacity-30"
          >
            export csv
          </button>
        </div>
      </div>

      {error && <div className="font-mono text-[11px] text-accent mb-4">{error}</div>}

      {!data ? (
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-ink-muted py-8 text-center">
          loading usage…
        </div>
      ) : data.entries.length === 0 ? (
        <div className="text-[14px] text-ink-soft italic font-serif text-center py-12 border border-hairline">
          No usage recorded for this project in the selected range.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <Aggregation
              title="By member"
              rows={data.by_member.map(r => ({ label: r.email ?? '—', value: r.spend, count: r.calls }))}
            />
            <Aggregation
              title="By model"
              rows={data.by_model.map(r => ({ label: r.model, value: r.spend, count: r.calls }))}
            />
          </div>

          {/* daily sparkline */}
          {data.by_day.length > 0 && (
            <div className="mb-10">
              <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-muted mb-2">
                daily spend
              </div>
              <DailyBars rows={data.by_day} />
            </div>
          )}

          {/* entries */}
          <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-muted border-b border-hairline pb-2 mb-2 grid grid-cols-[120px_1fr_120px_80px_80px_80px] gap-3">
            <span>date</span>
            <span>user</span>
            <span>model</span>
            <span>modality</span>
            <span className="text-right">tokens</span>
            <span className="text-right">cost</span>
          </div>
          <div className="divide-y divide-hairline">
            {data.entries.slice(0, 200).map(e => (
              <div key={e.id} className="grid grid-cols-[120px_1fr_120px_80px_80px_80px] gap-3 py-2 text-[12px] items-center">
                <span className="font-mono text-[10px] text-ink-muted">
                  {new Date(e.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-ink truncate" title={e.member_email ?? ''}>{e.member_email ?? '—'}</span>
                <span className="font-mono text-[10px] text-ink-soft truncate">{e.model ?? '—'}</span>
                <span className="font-mono text-[10px] text-ink-muted">{e.modality ?? '—'}</span>
                <span className="font-mono text-[10px] text-ink-muted text-right tabular-nums">
                  {e.prompt_tokens != null && e.completion_tokens != null
                    ? `${e.prompt_tokens}/${e.completion_tokens}`
                    : e.prompt_tokens ?? '—'}
                </span>
                <span className="font-mono text-[11px] text-ink text-right tabular-nums">
                  ${e.cost_usd.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
          {data.entries.length > 200 && (
            <div className="font-mono text-[10px] tracking-[0.06em] uppercase text-ink-muted mt-3 text-center">
              showing first 200 of {data.entries.length} · export csv for full set
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Aggregation({
  title,
  rows,
}: { title: string; rows: { label: string; value: number; count: number }[] }) {
  const max = Math.max(0.01, ...rows.map(r => r.value))
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.1em] uppercase text-ink-muted mb-2 border-b border-hairline pb-2">
        {title}
      </div>
      <div className="space-y-2">
        {rows.slice(0, 6).map(r => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between text-[12px] mb-0.5">
              <span className="text-ink truncate pr-3">{r.label}</span>
              <span className="font-mono text-[11px] tabular-nums text-ink whitespace-nowrap">
                ${r.value.toFixed(2)}
                <span className="text-ink-muted ml-2">{r.count}×</span>
              </span>
            </div>
            <div className="relative h-[2px] bg-hairline">
              <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DailyBars({ rows }: { rows: { day: string; spend: number; calls: number }[] }) {
  const max = Math.max(0.01, ...rows.map(r => r.spend))
  return (
    <div className="flex items-end gap-1 h-[80px] border-b border-hairline">
      {rows.map(r => (
        <div
          key={r.day}
          className="flex-1 bg-ink/85 hover:bg-accent transition-colors min-w-0"
          style={{ height: `${(r.spend / max) * 100}%` }}
          title={`${r.day} — $${r.spend.toFixed(2)} · ${r.calls} calls`}
        />
      ))}
    </div>
  )
}
