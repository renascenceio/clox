'use client'

/**
 * SystemStatus — uptime panel.
 *
 * Each system is a row: name (with status dot) + a last-32-bars uptime
 * histogram + the 30-day uptime percentage. Bar tones encode incidents
 * (green / amber / red) so glanceable by color.
 */

type Tone = 'green' | 'amber' | 'red'
type SysRow = {
  name: string
  up: number
  tone: Tone
  bars: Tone[] // length 32 (last 32 buckets)
}

// Helpers for compact bar definitions.
const G = (n: number): Tone[] => Array(n).fill('green' as const)
const A = (n: number): Tone[] => Array(n).fill('amber' as const)

const SYSTEMS: SysRow[] = [
  { name: 'Inference — Sonnet 4.5', up: 99.98, tone: 'green', bars: G(32) },
  {
    name: 'Inference — Opus 4',
    up: 99.94,
    tone: 'green',
    bars: [...G(26), 'amber', 'amber', ...G(4)] as Tone[],
  },
  { name: 'Inference — Haiku 4.5', up: 99.99, tone: 'green', bars: G(32) },
  {
    name: 'Vector store',
    up: 99.91,
    tone: 'green',
    bars: [...G(22), 'amber', ...G(9)] as Tone[],
  },
  {
    name: 'Web search tool',
    up: 97.42,
    tone: 'amber',
    bars: [...G(20), ...A(2), 'red', ...A(2), ...G(7)] as Tone[],
  },
  {
    name: 'Voice — synth',
    up: 99.74,
    tone: 'green',
    bars: [...G(20), 'amber', 'amber', ...G(10)] as Tone[],
  },
  { name: 'Auth · SSO', up: 100.0, tone: 'green', bars: G(32) },
]

function StatusDot({ tone }: { tone: Tone }) {
  const styles: Record<Tone, { bg: string; ring: string }> = {
    green: { bg: 'rgb(47 143 95)', ring: 'rgba(47,143,95,0.12)' },
    amber: { bg: 'rgb(185 138 43)', ring: 'rgba(185,138,43,0.12)' },
    red: { bg: 'rgb(181 58 40)', ring: 'rgba(181,58,40,0.12)' },
  }
  const { bg, ring } = styles[tone]
  return (
    <span
      className="inline-block w-[7px] h-[7px] rounded-full"
      style={{ background: bg, boxShadow: `0 0 0 4px ${ring}` }}
      aria-hidden
    />
  )
}

function Bars({ bars }: { bars: Tone[] }) {
  return (
    <div className="flex gap-0.5" aria-hidden>
      {bars.map((b, i) => (
        <span
          key={i}
          className="w-1 h-[18px] rounded-[1px]"
          style={{
            background:
              b === 'green'
                ? 'rgb(47 143 95)'
                : b === 'amber'
                  ? 'rgb(185 138 43)'
                  : 'rgb(181 58 40)',
          }}
        />
      ))}
    </div>
  )
}

export default function SystemStatus() {
  return (
    <div>
      {SYSTEMS.map((s, idx) => (
        <div
          key={s.name}
          className={`grid grid-cols-[1fr_auto_auto] gap-3 items-center px-[18px] py-3 ${
            idx === SYSTEMS.length - 1 ? '' : 'border-b border-hairline-soft'
          }`}
        >
          <div className="flex items-center gap-2.5 font-serif italic text-base">
            <StatusDot tone={s.tone} />
            <span>{s.name}</span>
          </div>
          <Bars bars={s.bars} />
          <div className="font-mono text-[10.5px] text-ink-muted tracking-[0.04em]">
            <b className="text-ink font-medium">{s.up.toFixed(2)}%</b> · 30d
          </div>
        </div>
      ))}
    </div>
  )
}
