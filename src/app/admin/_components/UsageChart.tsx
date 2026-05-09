'use client'

/**
 * UsageChart — daily-spend bar chart for the dashboard.
 *
 * Receives a series from the parent (`days = [{ day, spend, calls }]`).
 * Renders editorial bars (ink) with an SLO line at the 90th percentile and
 * a top stroke connecting the daily totals. Empty state stays calm — same
 * frame, "no usage yet" copy, no fake numbers.
 */

import { useMemo } from 'react'

interface Day {
  day: string
  spend: number
  calls: number
}

const W = 720
const H = 260
const PAD_L = 36
const PAD_R = 14
const PAD_T = 16
const PAD_B = 28

export default function UsageChart({ days }: { days: Day[] }) {
  const { svgInner, total, isEmpty } = useMemo(() => {
    if (!days.length) return { svgInner: '', total: 0, isEmpty: true }

    const totalsRaw = days.map(d => d.spend)
    const isEmpty = totalsRaw.every(v => v <= 0)
    const maxV = Math.max(0.01, ...totalsRaw) * 1.15
    const total = totalsRaw.reduce((a, b) => a + b, 0)

    const x = (i: number) => PAD_L + ((W - PAD_L - PAD_R) * i) / Math.max(1, days.length - 1)
    const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / maxV)

    let inner = ''

    // Gridlines + Y labels (5 ticks).
    for (let g = 0; g <= 4; g++) {
      const yy = PAD_T + ((H - PAD_T - PAD_B) * g) / 4
      const value = maxV * (1 - g / 4)
      inner += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${yy}" y2="${yy}" stroke="rgba(24,24,26,0.07)" stroke-width="1"/>`
      inner += `<text x="${PAD_L - 8}" y="${yy + 3}" text-anchor="end" font-family="Geist Mono, monospace" font-size="9" fill="#8E8C86">$${value.toFixed(value < 1 ? 2 : 0)}</text>`
    }

    // X labels — every Nth day so we don't crowd the axis.
    const stride = Math.max(1, Math.ceil(days.length / 6))
    days.forEach((d, i) => {
      if (i % stride !== 0 && i !== days.length - 1) return
      const dt = new Date(d.day)
      const lbl = isNaN(dt.getTime()) ? d.day : `${dt.getMonth() + 1}/${dt.getDate()}`
      inner += `<text x="${x(i)}" y="${H - PAD_B + 16}" text-anchor="middle" font-family="Geist Mono, monospace" font-size="9" fill="#8E8C86">${lbl}</text>`
    })

    if (!isEmpty) {
      // SLO dashed line (90th percentile).
      const sorted = [...totalsRaw].slice().sort((a, b) => a - b)
      const slo = sorted[Math.floor(sorted.length * 0.9)] || maxV * 0.78
      inner += `<line x1="${PAD_L}" x2="${W - PAD_R}" y1="${y(slo)}" y2="${y(slo)}" stroke="#B53A28" stroke-width="1" stroke-dasharray="3 3" opacity="0.55"/>`
      inner += `<text x="${W - PAD_R - 4}" y="${y(slo) - 4}" text-anchor="end" font-family="Geist Mono, monospace" font-size="9" fill="#B53A28">P90 $${slo.toFixed(2)}</text>`

      // Bars.
      const barW = Math.max(2, Math.min(18, (W - PAD_L - PAD_R) / Math.max(1, days.length) - 4))
      days.forEach((d, i) => {
        const cx = x(i) - barW / 2
        const top = y(d.spend)
        const bottom = y(0)
        inner += `<rect x="${cx}" y="${top}" width="${barW}" height="${Math.max(0, bottom - top)}" fill="#18181A" opacity="0.92"/>`
      })

      // Top stroke connecting bar tops.
      let line = ''
      days.forEach((d, i) => (line += (i ? 'L' : 'M') + x(i) + ',' + y(d.spend) + ' '))
      inner += `<path d="${line}" fill="none" stroke="#A8472A" stroke-width="1.2"/>`
    }

    return { svgInner: inner, total, isEmpty }
  }, [days])

  if (!days.length) {
    return (
      <div className="px-[18px] py-12 text-center">
        <span className="font-mono text-[11px] text-ink-muted tracking-[0.04em]">
          loading usage data…
        </span>
      </div>
    )
  }

  return (
    <div className="p-[18px]">
      <div className="flex flex-wrap items-center gap-[18px] font-mono text-[10.5px] text-ink-soft mb-3">
        <span className="inline-flex items-center">
          <span className="inline-block w-3 h-[2px] mr-1.5 align-middle bg-ink" aria-hidden />
          spend
        </span>
        <span className="inline-flex items-center">
          <span className="inline-block w-3 h-[2px] mr-1.5 align-middle bg-accent" aria-hidden />
          daily total stroke
        </span>
        <span className="ml-auto text-ink-muted">
          {isEmpty ? 'no usage logged yet' : `total $${total.toFixed(2)} · P90 line dashed`}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={260}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Spend over last ${days.length} days, total $${total.toFixed(2)}`}
        dangerouslySetInnerHTML={{ __html: svgInner }}
      />

      {isEmpty && (
        <div className="font-mono text-[11px] text-ink-muted tracking-[0.04em] text-center mt-2">
          start a chat to see real bars
        </div>
      )}
    </div>
  )
}
