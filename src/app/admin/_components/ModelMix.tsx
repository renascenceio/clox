'use client'

/**
 * ModelMix — share-of-completions list driven by /api/admin/dashboard's
 * `model_mix_24h`. Index column, serif italic name, share bar (accent on
 * row 0), percentage and call count.
 */

interface Entry {
  model: string
  calls: number
}

export default function ModelMix({ entries }: { entries: Entry[] }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="px-[18px] py-10 text-center font-mono text-[11px] text-ink-muted tracking-[0.04em]">
        no model traffic in 24h
      </div>
    )
  }

  const total = Math.max(1, entries.reduce((s, e) => s + e.calls, 0))
  const sorted = [...entries].sort((a, b) => b.calls - a.calls).slice(0, 6)

  return (
    <div>
      {sorted.map((m, i) => {
        const pct = (m.calls / total) * 100
        return (
          <div
            key={m.model}
            className={`grid grid-cols-[28px_1fr_auto_auto_auto] gap-3 items-center px-[18px] py-3 ${
              i === sorted.length - 1 ? '' : 'border-b border-hairline-soft'
            }`}
          >
            <div className="font-mono text-[10px] text-ink-muted tracking-[0.08em]">
              0{i + 1}
            </div>
            <div className="min-w-0">
              <div className="font-serif italic text-base truncate">{m.model || 'unknown'}</div>
              <div className="font-mono text-[10px] text-ink-muted tracking-[0.04em] mt-0.5 truncate">
                {labelFor(m.model)}
              </div>
            </div>
            <div className="w-[110px] h-1.5 bg-surface-alt rounded-[1px] overflow-hidden relative">
              <div
                className={`absolute left-0 top-0 bottom-0 ${i === 0 ? 'bg-accent' : 'bg-ink'}`}
                style={{ width: `${Math.min(100, pct * 2)}%` }}
              />
            </div>
            <div className="font-mono text-[11px] text-ink w-[42px] text-right">
              {pct < 1 ? pct.toFixed(1) : pct.toFixed(0)}%
            </div>
            <div className="font-mono text-[10.5px] text-ink-muted w-[72px] text-right tracking-[0.04em]">
              {m.calls} calls
            </div>
          </div>
        )
      })}
    </div>
  )
}

function labelFor(model: string): string {
  const m = (model ?? '').toLowerCase()
  if (m.includes('opus')) return 'reasoning · slow'
  if (m.includes('sonnet')) return 'general · balanced'
  if (m.includes('haiku')) return 'fast · cheap'
  if (m.includes('gpt-5') || m.includes('gpt-4')) return 'openai general'
  if (m.includes('gemini')) return 'google · multimodal'
  if (m.includes('grok')) return 'xai · code'
  if (m.includes('mistral')) return 'open weights'
  return '—'
}
