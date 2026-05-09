'use client'

/**
 * FeatureFlags — togglable rollout list.
 *
 * Mono key + sentence-case description, rollout %, and a flat ink toggle.
 * Local UI state only; wiring to a real flag store is a follow-up.
 */

import { useState } from 'react'

type Flag = {
  k: string
  d: string
  on: boolean
  pct: string
}

const INITIAL: Flag[] = [
  { k: 'composer.slash_palette', d: 'Slash key opens model/mode palette', on: true, pct: '100%' },
  { k: 'composer.voice_input', d: 'Voice input button next to send', on: true, pct: '100%' },
  { k: 'modes.image.beta', d: 'Image mode (beta) for Studio plans', on: true, pct: '42%' },
  { k: 'modes.code.agent_v2', d: 'Agentic code mode — second iteration', on: false, pct: '12%' },
  { k: 'admin.cmdk', d: '⌘K jumper for admin surface', on: true, pct: '100%' },
  { k: 'pricing.studio.eu', d: 'Studio plan, EUR billing', on: false, pct: '0%' },
  { k: 'archive.export.pdf', d: 'Export chat archive as PDF', on: true, pct: '78%' },
]

export default function FeatureFlags() {
  const [flags, setFlags] = useState<Flag[]>(INITIAL)

  const toggle = (key: string) =>
    setFlags(prev => prev.map(f => (f.k === key ? { ...f, on: !f.on } : f)))

  return (
    <div>
      {flags.map((f, idx) => (
        <div
          key={f.k}
          className={`grid grid-cols-[1fr_80px_auto] gap-3 items-center px-[18px] py-3 text-[13px] ${
            idx === flags.length - 1 ? '' : 'border-b border-hairline-soft'
          }`}
        >
          <div className="min-w-0">
            <div className="font-mono text-[11.5px] text-ink tracking-[0.02em] truncate">
              {f.k}
            </div>
            <div className="text-[12px] text-ink-muted mt-0.5 truncate">{f.d}</div>
          </div>
          <div className="font-mono text-[11px] text-ink-soft tracking-[0.04em] text-right">
            {f.pct}
          </div>
          <button
            type="button"
            onClick={() => toggle(f.k)}
            aria-pressed={f.on}
            aria-label={`${f.on ? 'Disable' : 'Enable'} ${f.k}`}
            className={`w-8 h-4 p-[1.5px] rounded-[9px] border inline-flex items-center transition-colors ${
              f.on ? 'bg-ink border-ink justify-end' : 'bg-transparent border-hairline justify-start'
            }`}
          >
            <span
              className={`block w-[11px] h-[11px] rounded-full ${
                f.on ? 'bg-bg' : 'bg-ink-soft'
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  )
}
