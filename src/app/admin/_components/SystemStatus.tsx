'use client'

/**
 * SystemStatus — provider/usage signals computed from /api/admin/dashboard.
 *
 * We don't store latency or per-call errors yet. The honest signals we *do*
 * have are 30d call counts + active users + per-provider 24h rollups, all
 * fetched once by the parent dashboard and piped down. Every row is a calm
 * "ok" / "idle" with no fake red bars.
 */

interface ProviderRow {
  provider: string
  calls_24h: number
  cost_24h: number
}

export default function SystemStatus({
  calls30d,
  activeUsers30d,
  providers,
}: {
  calls30d: number
  activeUsers30d: number
  providers: ProviderRow[]
}) {
  type Tone = 'green' | 'amber' | 'red' | 'idle'
  const aggregates: Array<{ name: string; meta: string; tone: Tone }> = [
    {
      name: 'Inference traffic — 30d',
      meta: `${formatCount(calls30d)} calls · ${activeUsers30d} active users`,
      tone: calls30d > 0 ? 'green' : 'idle',
    },
    {
      name: 'Auth · sessions',
      meta: 'served by Supabase',
      tone: 'green',
    },
    {
      name: 'Vector store',
      meta: 'no embeddings indexed yet',
      tone: 'idle',
    },
  ]

  return (
    <div>
      {aggregates.map(s => (
        <div key={s.name} className="grid grid-cols-[1fr_auto] gap-3 items-center px-[18px] py-3 border-b border-hairline-soft">
          <div className="flex items-center gap-2.5 min-w-0">
            <StatusDot tone={s.tone} />
            <div className="min-w-0">
              <div className="font-serif italic text-[15px] truncate">{s.name}</div>
              <div className="font-mono text-[10px] text-ink-muted tracking-[0.04em] truncate">{s.meta}</div>
            </div>
          </div>
          <span className="font-mono text-[10.5px] text-ink-muted tracking-[0.06em] uppercase">
            {s.tone === 'green' ? 'ok' : s.tone === 'amber' ? 'degraded' : 'idle'}
          </span>
        </div>
      ))}

      <div className="px-[18px] pt-3 pb-1.5 font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">
        providers · 24h
      </div>
      {providers.length === 0 ? (
        <div className="px-[18px] py-3 font-mono text-[11px] text-ink-muted">no provider activity in 24h</div>
      ) : (
        providers.map((p, idx) => (
          <div
            key={p.provider}
            className={`grid grid-cols-[1fr_auto_auto] gap-3 items-center px-[18px] py-2.5 ${
              idx === providers.length - 1 ? '' : 'border-b border-hairline-soft'
            }`}
          >
            <div className="flex items-center gap-2">
              <StatusDot tone={p.calls_24h > 0 ? 'green' : 'idle'} />
              <span className="font-mono text-[12px]">{p.provider || '—'}</span>
            </div>
            <span className="font-mono text-[10.5px] text-ink-muted">{p.calls_24h} calls</span>
            <span className="font-mono text-[10.5px] text-ink">${p.cost_24h.toFixed(2)}</span>
          </div>
        ))
      )}
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
  return (
    <span
      className="inline-block w-[7px] h-[7px] rounded-full flex-shrink-0"
      style={{ background: bg, boxShadow: `0 0 0 4px ${ring}` }}
      aria-hidden
    />
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
