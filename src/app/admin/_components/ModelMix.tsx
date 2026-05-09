'use client'

/**
 * ModelMix — share-of-completions list.
 *
 * Each row: index, serif italic label + mono tag, share bar, percentage,
 * latency. The first row is "accent" (terracotta) to draw the eye to the
 * dominant model.
 */

type Row = {
  label: string
  tag: string
  pct: number
  lat: string
  acc?: boolean
}

const MODELS: Row[] = [
  { label: 'Claude Sonnet 4.5', tag: 'general · balanced', pct: 42, lat: '412 ms', acc: true },
  { label: 'Claude Opus 4', tag: 'reasoning · slow', pct: 24, lat: '1,210 ms' },
  { label: 'Claude Haiku 4.5', tag: 'fast · cheap', pct: 18, lat: '186 ms' },
  { label: 'GPT-5', tag: 'general', pct: 11, lat: '520 ms' },
  { label: 'Internal · captions', tag: 'voice synth', pct: 5, lat: '88 ms' },
]

export default function ModelMix() {
  return (
    <div>
      {MODELS.map((m, i) => (
        <div
          key={m.label}
          className={`grid grid-cols-[28px_1fr_auto_auto_auto] gap-3 items-center px-[18px] py-3 ${
            i === MODELS.length - 1 ? '' : 'border-b border-hairline-soft'
          }`}
        >
          <div className="font-mono text-[10px] text-ink-muted tracking-[0.08em]">
            0{i + 1}
          </div>
          <div className="min-w-0">
            <div className="font-serif italic text-base truncate">{m.label}</div>
            <div className="font-mono text-[10px] text-ink-muted tracking-[0.04em] mt-0.5 truncate">
              {m.tag}
            </div>
          </div>
          <div className="w-[110px] h-1.5 bg-surface-alt rounded-[1px] overflow-hidden relative">
            <div
              className={`absolute left-0 top-0 bottom-0 ${m.acc ? 'bg-accent' : 'bg-ink'}`}
              style={{ width: `${m.pct * 2}%` }}
            />
          </div>
          <div className="font-mono text-[11px] text-ink w-[42px] text-right">{m.pct}%</div>
          <div className="font-mono text-[10.5px] text-ink-muted w-[72px] text-right tracking-[0.04em]">
            {m.lat}
          </div>
        </div>
      ))}
    </div>
  )
}
