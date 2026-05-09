'use client'

/**
 * /admin/flags — full feature-flags management.
 *
 * Adds rollout-pct slider editing on top of the dashboard panel: every flag
 * has a description, an enabled toggle, and an inline %-rollout slider that
 * PATCHes on commit. Changes are audit-logged server-side.
 */

import { useEffect, useState } from 'react'
import AdminShell, {
  AdminIconBtn,
  AdminPanel,
} from '@/shared/ui/admin/AdminShell'

interface Flag {
  key: string
  description: string | null
  enabled: boolean
  rollout_pct: number
  updated_at: string
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<Flag[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/flags', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { flags?: Flag[]; error?: string }) => {
        if (cancelled) return
        if (j.error) setError(j.error)
        else { setFlags(j.flags ?? []); setError(null) }
      })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [tick])

  async function patch(key: string, patch: Partial<Flag>) {
    setFlags(curr => curr?.map(f => f.key === key ? { ...f, ...patch } : f) ?? null)
    try {
      const res = await fetch('/api/admin/flags', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, ...patch }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = (await res.json()) as { flag: Flag }
      setFlags(curr => curr?.map(f => f.key === key ? updated.flag : f) ?? null)
    } catch (e) {
      console.error('[v0] flag patch failed:', e)
      setTick(t => t + 1) // re-fetch to recover
    }
  }

  const enabledCount = flags?.filter(f => f.enabled).length ?? 0
  const partialCount = flags?.filter(f => f.enabled && f.rollout_pct < 100).length ?? 0

  return (
    <AdminShell
      crumb={['admin', 'platform']}
      here="Feature flags"
      eyebrow="server-side gates · audit logged"
      heading={<>Flip features <em className="italic">live, with care.</em></>}
      lead="Every toggle here flows through a PATCH that writes to admin_feature_flags and appends to the audit log. Use rollout % to gate a feature to a slice of traffic before flipping fully."
      syncHint={flags ? `${enabledCount}/${flags.length} enabled · ${partialCount} partial` : 'syncing…'}
      actions={
        <AdminIconBtn title="Refresh" onClick={() => setTick(t => t + 1)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5a4.5 4.5 0 1 1-1.32-3.18M11 1.5v3H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </AdminIconBtn>
      }
    >
      <AdminPanel title="All flags" meta={flags ? `${flags.length} keys` : ''}>
        {error ? (
          <div className="px-[18px] py-10 text-center font-mono text-[11px] text-[rgb(181_58_40)]">{error}</div>
        ) : flags === null ? (
          <div className="px-[18px] py-10 text-center font-mono text-[11px] text-ink-muted">loading flags…</div>
        ) : flags.length === 0 ? (
          <div className="px-[18px] py-10 text-center font-mono text-[11px] text-ink-muted">no flags configured yet</div>
        ) : (
          flags.map((f, idx) => (
            <div key={f.key} className={`px-[18px] py-4 ${idx === flags.length - 1 ? '' : 'border-b border-hairline-soft'}`}>
              <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                <div className="min-w-0">
                  <div className="font-mono text-[12.5px] text-ink tracking-[0.02em] truncate">{f.key}</div>
                  <div className="text-[12.5px] text-ink-muted mt-0.5">{f.description ?? '—'}</div>
                  <div className="font-mono text-[10px] text-ink-muted mt-1.5">updated {timeAgo(f.updated_at)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => patch(f.key, { enabled: !f.enabled })}
                  aria-pressed={f.enabled}
                  className={`w-9 h-[18px] p-[1.5px] rounded-[10px] border inline-flex items-center transition-colors flex-shrink-0 ${f.enabled ? 'bg-ink border-ink justify-end' : 'bg-transparent border-hairline justify-start'}`}
                >
                  <span className={`block w-[13px] h-[13px] rounded-full ${f.enabled ? 'bg-bg' : 'bg-ink-soft'}`} />
                </button>
              </div>
              {f.enabled && (
                <div className="mt-3 grid grid-cols-[1fr_64px] gap-3 items-center">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={f.rollout_pct}
                    onChange={e => {
                      const next = Number(e.target.value)
                      setFlags(curr => curr?.map(x => x.key === f.key ? { ...x, rollout_pct: next } : x) ?? null)
                    }}
                    onMouseUp={e => patch(f.key, { rollout_pct: Number((e.target as HTMLInputElement).value) })}
                    onTouchEnd={e => patch(f.key, { rollout_pct: Number((e.target as HTMLInputElement).value) })}
                    className="w-full h-1 bg-surface-alt accent-ink"
                  />
                  <span className="font-mono text-[11px] text-ink text-right tabular-nums">{f.rollout_pct}%</span>
                </div>
              )}
            </div>
          ))
        )}
      </AdminPanel>
    </AdminShell>
  )
}

function timeAgo(iso: string): string {
  try {
    const d = new Date(iso).getTime()
    const sec = Math.floor((Date.now() - d) / 1000)
    if (sec < 60) return `${sec}s ago`
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
    return `${Math.floor(sec / 86400)}d ago`
  } catch { return '—' }
}
