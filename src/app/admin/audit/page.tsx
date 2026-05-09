'use client'

/**
 * /admin/audit — append-only log of every super-admin action.
 *
 * Filters: action prefix (flag.*, setting.*, user.*) + actor email substring.
 * Each row expands inline to show the JSON payload that was attached at
 * write-time, formatted with editorial typography.
 */

import { useEffect, useState } from 'react'
import AdminShell, {
  AdminFilter,
  AdminIconBtn,
  AdminPanel,
} from '@/shared/ui/admin/AdminShell'

interface AuditEntry {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  target_kind: string | null
  target_id: string | null
  payload: unknown
  created_at: string
}

const ACTION_FILTERS = ['all', 'flag', 'setting', 'user', 'invoice'] as const
type ActionFilter = (typeof ACTION_FILTERS)[number]

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all')
  const [actorFilter, setActorFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const search = new URLSearchParams()
    search.set('limit', '300')
    if (actionFilter !== 'all') search.set('action', `${actionFilter}.update`)
    if (actorFilter.trim()) search.set('actor', actorFilter.trim())
    fetch(`/api/admin/audit?${search.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { entries?: AuditEntry[] }) => { if (!cancelled) setEntries(j.entries ?? []) })
      .catch(e => console.error('[v0] /admin/audit fetch failed', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [actionFilter, actorFilter, tick])

  return (
    <AdminShell
      crumb={['admin', 'platform']}
      here="Audit log"
      eyebrow="every super-admin action · append-only"
      heading={<>Who changed what, <em className="italic">and when.</em></>}
      lead="An immutable receipt of every privileged action — flag toggles, setting writes, user changes. Filter by actor or action class to assemble a paper trail."
      headExtra={ACTION_FILTERS.map(f => (
        <AdminFilter key={f} active={actionFilter === f} onClick={() => setActionFilter(f)}>
          {f}
        </AdminFilter>
      ))}
      syncHint={loading ? 'syncing…' : `${entries.length} entries`}
      actions={
        <AdminIconBtn title="Refresh" onClick={() => setTick(t => t + 1)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5a4.5 4.5 0 1 1-1.32-3.18M11 1.5v3H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </AdminIconBtn>
      }
    >
      <AdminPanel
        title="Recent actions"
        meta={`${entries.length} rows`}
        toolbar={
          <div className="flex items-center justify-between gap-3 px-[18px] py-3 border-b border-hairline-soft">
            <div className="flex items-center gap-2 px-2.5 py-1.5 border border-hairline-soft rounded-sharp bg-surface w-full max-w-[420px] font-mono text-[11px]">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-ink-muted">
                <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.1" />
                <path d="m7 7 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              </svg>
              <input
                value={actorFilter}
                onChange={e => setActorFilter(e.target.value)}
                placeholder="filter by actor email…"
                className="flex-1 bg-transparent outline-none border-0 font-mono text-[11px] text-ink placeholder:text-ink-muted"
              />
            </div>
          </div>
        }
      >
        <div>
          {loading ? (
            <div className="px-[18px] py-10 text-center font-mono text-[11px] text-ink-muted">loading audit log…</div>
          ) : entries.length === 0 ? (
            <div className="px-[18px] py-10 text-center font-mono text-[11px] text-ink-muted">no entries match — try a wider filter</div>
          ) : entries.map((e, idx) => {
            const expanded = expandedId === e.id
            return (
              <div key={e.id} className={`px-[18px] py-3 ${idx === entries.length - 1 ? '' : 'border-b border-hairline-soft'}`}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : e.id)}
                  className="w-full grid grid-cols-[16px_2fr_2fr_1.5fr_auto] gap-3 items-baseline text-left"
                >
                  <span aria-hidden className="font-mono text-[10.5px] text-ink-muted">{expanded ? '−' : '+'}</span>
                  <div className="min-w-0">
                    <div className="font-serif italic text-[14.5px] truncate">{e.action}</div>
                    <div className="font-mono text-[10px] text-ink-muted truncate">{e.target_kind}{e.target_id ? ` · ${e.target_id}` : ''}</div>
                  </div>
                  <div className="font-mono text-[11px] text-ink-soft truncate">{e.actor_email ?? '—'}</div>
                  <div className="font-mono text-[10.5px] text-ink-muted">{shortTime(e.created_at)}</div>
                  <div className="font-mono text-[10px] text-ink-muted text-right">{summarize(e.payload)}</div>
                </button>
                {expanded && (
                  <pre className="mt-2 px-3 py-2 bg-surface-alt border border-hairline-soft rounded-sharp font-mono text-[10.5px] text-ink-soft whitespace-pre-wrap break-all">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      </AdminPanel>
    </AdminShell>
  )
}

function summarize(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const keys = Object.keys(payload as Record<string, unknown>)
  if (keys.length === 0) return ''
  return `${keys.length} ${keys.length === 1 ? 'field' : 'fields'}`
}
function shortTime(iso: string): string {
  try {
    const d = new Date(iso)
    return `${d.toISOString().slice(5, 10)} ${d.toTimeString().slice(0, 5)}`
  } catch { return '—' }
}
