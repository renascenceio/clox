'use client'

/**
 * FeatureFlags — list view that reads from /api/admin/flags and toggles
 * with optimistic updates. Each toggle PATCHes the API which writes the
 * row, audits the change, and returns the canonical row back to us.
 */

import { useEffect, useState } from 'react'

interface Flag {
  key: string
  description: string | null
  enabled: boolean
  rollout_pct: number
  updated_at: string
}

export default function FeatureFlags() {
  const [flags, setFlags] = useState<Flag[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/flags', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { flags?: Flag[]; error?: string }) => {
        if (cancelled) return
        if (j.error) setError(j.error)
        else setFlags(j.flags ?? [])
      })
      .catch(e => { if (!cancelled) setError(String(e)) })
    return () => { cancelled = true }
  }, [])

  async function toggle(key: string, next: boolean) {
    setFlags(curr => curr?.map(f => f.key === key ? { ...f, enabled: next } : f) ?? null)
    try {
      const res = await fetch('/api/admin/flags', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, enabled: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const updated = (await res.json()) as { flag: Flag }
      setFlags(curr => curr?.map(f => f.key === key ? updated.flag : f) ?? null)
    } catch (e) {
      // Revert on failure.
      setFlags(curr => curr?.map(f => f.key === key ? { ...f, enabled: !next } : f) ?? null)
      console.error('[v0] flag toggle failed:', e)
    }
  }

  if (error) {
    return (
      <div className="px-[18px] py-6 font-mono text-[11px] text-[rgb(181_58_40)]">
        {error}
      </div>
    )
  }

  if (flags === null) {
    return <div className="px-[18px] py-6 font-mono text-[11px] text-ink-muted">loading flags…</div>
  }

  if (flags.length === 0) {
    return <div className="px-[18px] py-6 font-mono text-[11px] text-ink-muted">no flags configured</div>
  }

  return (
    <div>
      {flags.map((f, idx) => (
        <div
          key={f.key}
          className={`grid grid-cols-[1fr_80px_auto] gap-3 items-center px-[18px] py-3 text-[13px] ${
            idx === flags.length - 1 ? '' : 'border-b border-hairline-soft'
          }`}
        >
          <div className="min-w-0">
            <div className="font-mono text-[11.5px] text-ink tracking-[0.02em] truncate">{f.key}</div>
            <div className="text-[12px] text-ink-muted mt-0.5 truncate">{f.description ?? '—'}</div>
          </div>
          <div className="font-mono text-[11px] text-ink-soft tracking-[0.04em] text-right">{f.rollout_pct}%</div>
          <button
            type="button"
            onClick={() => toggle(f.key, !f.enabled)}
            aria-pressed={f.enabled}
            aria-label={`${f.enabled ? 'Disable' : 'Enable'} ${f.key}`}
            className={`w-8 h-4 p-[1.5px] rounded-[9px] border inline-flex items-center transition-colors ${
              f.enabled ? 'bg-ink border-ink justify-end' : 'bg-transparent border-hairline justify-start'
            }`}
          >
            <span className={`block w-[11px] h-[11px] rounded-full ${f.enabled ? 'bg-bg' : 'bg-ink-soft'}`} />
          </button>
        </div>
      ))}
    </div>
  )
}
