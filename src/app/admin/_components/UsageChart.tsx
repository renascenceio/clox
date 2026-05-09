'use client'

/**
 * UsageChart — stacked-area usage chart for the dashboard.
 *
 * Replicates the reference SVG: gridlines + Y-axis tick labels, stacked
 * areas for chat / research / code / image / voice, an SLO dashed line,
 * a top outline of the daily total and milestone dots every 5 days.
 *
 * Data is generated deterministically from a tiny seeded sin/cos pulse so
 * the chart renders the same on every reload and on SSR re-hydration.
 */

import { useMemo } from 'react'

const W = 720
const H = 260
const PAD_L = 36
const PAD_R = 14
const PAD_T = 16
const PAD_B = 28
const N = 30

// Deterministic pseudo-random — no Math.random, so SSR + CSR match.
function series(seed: number, base: number, swing: number) {
  let v = base
  const arr: number[] = []
  // Mulberry-like deterministic noise driven by integer counter.
  let s = Math.floor(seed * 1000)
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = 0; i < N; i++) {
    v +=
      (Math.sin(i * 0.6 + seed) + Math.cos(i * 0.3 + seed * 1.2)) * swing * 0.4 +
      (rand() - 0.5) * swing * 0.6
    arr.push(Math.max(2, v))
  }
  return arr
}

const COLORS = {
  chat: '#18181A',
  research: '#A8472A',
  code: '#2F8F5F',
  image: '#B98A2B',
  voice: '#5C544A',
} as const

const ORDER: (keyof typeof COLORS)[] = ['voice', 'image', 'code', 'research', 'chat']

export default function UsageChart() {
  const { svgInner, totals } = useMemo(() => {
    const data = {
      chat: series(1.3, 60, 8),
      research: series(2.7, 38, 6),
      code: series(0.9, 24, 4),
      image: series(3.1, 14, 3),
      voice: series(4.0, 8, 2),
    }
    const totals = data.chat.map((_, i) =>
      data.chat[i] + data.research[i] + data.code[i] + data.image[i] + data.voice[i],
    )
    const maxV = Math.max(...totals) * 1.1
    const x = (i: number) => PAD_L + ((W - PAD_L - PAD_R) * i) / (N - 1)
    const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / maxV)

    const buildArea = (top: number[], baseLine?: number[]) => {
      let d = ''
      top.forEach((v, i) => {
        d += (i ? 'L' : 'M') + x(i) + ',' + y(v + (baseLine ? baseLine[i] : 0)) + ' '
      })
      if (baseLine) {
        for (let i = N - 1; i >= 0; i--) d += 'L' + x(i) + ',' + y(baseLine[i]) + ' '
      } else {
        d += 'L' + x(N - 1) + ',' + y(0) + ' L' + x(0) + ',' + y(0)
      }
      return d + 'Z'
    }

    let inner = ''

    // Gridlines + Y labels (5 ticks).
    for (let g = 0; g <= 4; g++) {
      const yy = PAD_T + ((H - PAD_T - PAD_B) * g) / 4
      inner += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${yy}" y2="${yy}" stroke="rgba(24,24,26,0.07)" stroke-width="1"/>`
      inner += `<text x="${PAD_L - 8}" y="${yy + 3}" text-anchor="end" font-family="Geist Mono, monospace" font-size="9" fill="#8E8C86">${Math.round(maxV * (1 - g / 4))}</text>`
    }

    // X labels every 5 days.
    for (let i = 0; i < N; i += 5) {
      inner += `<text x="${x(i)}" y="${H - PAD_B + 16}" text-anchor="middle" font-family="Geist Mono, monospace" font-size="9" fill="#8E8C86">d${i + 1}</text>`
    }

    // SLO dashed line.
    const slo = maxV * 0.78
    inner += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(slo)}" y2="${y(slo)}" stroke="#B53A28" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>`
    inner += `<text x="${W - PAD_R - 4}" y="${y(slo) - 4}" text-anchor="end" font-family="Geist Mono, monospace" font-size="9" fill="#B53A28">SLO ${Math.round(slo)}M</text>`

    // Stacked areas — bottom-up so each stacks over the previous.
    let runningBase = new Array<number>(N).fill(0)
    for (const k of ORDER) {
      const top = data[k]
      const base = runningBase.slice()
      runningBase = runningBase.map((b, i) => b + top[i])
      inner += `<path d="${buildArea(top, base)}" fill="${COLORS[k]}" opacity="${k === 'chat' ? 0.92 : 0.85}"/>`
    }

    // Top outline (total).
    let line = ''
    totals.forEach((v, i) => (line += (i ? 'L' : 'M') + x(i) + ',' + y(v) + ' '))
    inner += `<path d="${line}" fill="none" stroke="#18181A" stroke-width="1.3"/>`

    // Marker dots every 5 days.
    totals.forEach((v, i) => {
      if (i % 5 === 4)
        inner += `<circle cx="${x(i)}" cy="${y(v)}" r="2.6" fill="#FAF9F4" stroke="#18181A" stroke-width="1.2"/>`
    })

    return { svgInner: inner, totals }
  }, [])

  return (
    <div className="p-[18px]">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-[18px] font-mono text-[10.5px] text-ink-soft mb-3">
        {Object.entries(COLORS).map(([k, c]) => (
          <span key={k} className="inline-flex items-center">
            <span
              className="inline-block w-3 h-[2px] mr-1.5 align-middle"
              style={{ background: c }}
              aria-hidden
            />
            {k}
          </span>
        ))}
        <span className="ml-auto text-ink-muted">SLO line dashed</span>
      </div>

      {/* SVG: dangerouslySet is fine — content is locally generated, no user input. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={260}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Usage by mode over 30 days, total ${Math.round(totals.reduce((a, b) => a + b, 0))} million tokens`}
        dangerouslySetInnerHTML={{ __html: svgInner }}
      />
    </div>
  )
}
