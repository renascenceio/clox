'use client'

/**
 * LiveRequestFeed — tail of `usage_logs` polled from /api/admin/live.
 *
 * One row per request: ink dot, serif italic name + mono meta, latency-ish
 * cost on the right, timestamp at the far right. Polls every 5s. Caps at
 * 14 visible rows.
 */

import { useEffect, useState } from 'react'

interface Entry {
  id: string
  created_at: string
  provider: string | null
  model: string
  chat_type: string
  cost_usd: number
  prompt_tokens: number
  completion_tokens: number
  domain: string | null
  user: { name: string; email: string }
}

export default function LiveRequestFeed() {
  const [rows, setRows] = useState<Entry[]>([])
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch('/api/admin/live', { cache: 'no-store' })
        if (!res.ok) {
          setStale(true)
          return
        }
        const j = (await res.json()) as { entries?: Entry[] }
        if (cancelled) return
        setRows(j.entries ?? [])
        setStale(false)
      } catch {
        setStale(true)
      }
    }
    tick()
    const id = window.setInterval(tick, 5000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  return (
    <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
      {rows.length === 0 ? (
        <div className="px-[18px] py-12 text-center font-mono text-[11px] text-ink-muted tracking-[0.04em]">
          {stale ? 'reconnecting…' : 'no requests in the last hour'}
        </div>
      ) : (
        rows.map((r, idx) => (
          <div
            key={r.id}
            className={`grid grid-cols-[12px_1fr_auto_auto] gap-2.5 items-baseline px-[18px] py-2.5 text-[13px] ${
              idx === rows.length - 1 ? '' : 'border-b border-hairline-soft'
            }`}
          >
            <span aria-hidden className="w-1.5 h-1.5 rounded-full mt-1.5 bg-[rgb(47_143_95)]" />
            <div className="min-w-0">
              <span className="font-serif italic text-[14.5px] truncate inline-block max-w-full align-bottom">
                {r.user.name || (r.user.email ? r.user.email.split('@')[0] : '—')}
              </span>
              <div className="font-mono text-[10.5px] text-ink-muted tracking-[0.04em] truncate">
                {r.user.email || 'unknown'} · {r.chat_type} · {r.model}
              </div>
            </div>
            <span className="font-mono text-[10.5px] text-ink">
              ${r.cost_usd.toFixed(4)}
            </span>
            <span className="font-mono text-[10.5px] text-ink-muted">
              {formatTime(r.created_at)}
            </span>
          </div>
        ))
      )}
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toTimeString().slice(0, 8)
  } catch {
    return '—'
  }
}
