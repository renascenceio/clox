'use client'

/**
 * LiveRequestFeed — animated stream of inference requests.
 *
 * New rows fade-slide in at the top every ~2.4s. Capped at 14 visible rows;
 * older rows are dropped from the bottom. Status colors match the editorial
 * green / amber / red tokens used elsewhere on the dashboard.
 *
 * The stream is purely cosmetic — sample data picked from a small fixed
 * pool. We only generate fresh entries client-side (after mount) so SSR
 * markup stays empty and there's no hydration mismatch.
 */

import { useEffect, useState } from 'react'

const POOL = [
  { who: 'Marlowe Sato', ws: 'aperture-press', model: 'sonnet 4.5', mode: 'research', tk: '4.1k' },
  { who: 'Cassian Vellum', ws: 'marginalia-co', model: 'opus 4', mode: 'chat', tk: '2.4k' },
  { who: 'Ines Goyal', ws: 'northbound', model: 'haiku 4.5', mode: 'code', tk: '822' },
  { who: 'Petra Lindh', ws: 'faraday-press', model: 'sonnet 4.5', mode: 'image', tk: '1.1k' },
  { who: 'Wren Okafor', ws: 'stoa-studio', model: 'gpt-5', mode: 'chat', tk: '3.2k' },
  { who: 'Tomás Beneš', ws: 'quartermaster', model: 'sonnet 4.5', mode: 'voice', tk: '612' },
  { who: 'Hadiya Reyes', ws: 'aperture-press', model: 'opus 4', mode: 'research', tk: '5.4k' },
  { who: 'Soren Mistry', ws: 'marginalia-co', model: 'haiku 4.5', mode: 'code', tk: '1.9k' },
] as const

type Row = {
  id: number
  who: string
  ws: string
  model: string
  mode: string
  tk: string
  status: 'ok' | 'slow' | 'err'
  lat: string
  ts: string
}

function makeRow(id: number): Row {
  const it = POOL[Math.floor(Math.random() * POOL.length)]
  const r = Math.random()
  const status: Row['status'] = r < 0.06 ? 'err' : r < 0.2 ? 'slow' : 'ok'
  const latNum =
    status === 'ok'
      ? 180 + ((Math.random() * 220) | 0)
      : status === 'slow'
        ? 640 + ((Math.random() * 180) | 0)
        : 0
  const lat = status === 'err' ? '500 err' : `${latNum} ms`
  const ts = new Date().toTimeString().slice(0, 8)
  return { id, ...it, status, lat, ts }
}

export default function LiveRequestFeed() {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    // Initial fill with 10 rows (client-only, no SSR mismatch).
    let counter = 0
    const initial: Row[] = []
    for (let i = 0; i < 10; i++) initial.push(makeRow(counter++))
    setRows(initial)
    const id = setInterval(() => {
      setRows(prev => [makeRow(counter++), ...prev].slice(0, 14))
    }, 2400)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="max-h-[360px] overflow-y-auto custom-scrollbar">
      {rows.length === 0 && (
        <div className="px-[18px] py-6 font-mono text-[11px] text-ink-muted tracking-[0.04em]">
          waiting for first request…
        </div>
      )}
      {rows.map((r, idx) => (
        <div
          key={r.id}
          className={`grid grid-cols-[12px_1fr_auto_auto] gap-2.5 items-baseline px-[18px] py-2.5 text-[13px] ${
            idx === rows.length - 1 ? '' : 'border-b border-hairline-soft'
          }`}
        >
          <span
            aria-hidden
            className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
              r.status === 'ok'
                ? 'bg-[rgb(47_143_95)]'
                : r.status === 'slow'
                  ? 'bg-[rgb(185_138_43)]'
                  : 'bg-[rgb(181_58_40)]'
            }`}
          />
          <div>
            <span className="font-serif italic text-[14.5px]">{r.who}</span>
            <div className="font-mono text-[10.5px] text-ink-muted tracking-[0.04em]">
              {r.ws} · {r.mode} · {r.model} · {r.tk} tok
            </div>
          </div>
          <span
            className={`font-mono text-[10.5px] ${
              r.status === 'err'
                ? 'text-[rgb(181_58_40)]'
                : r.status === 'slow'
                  ? 'text-[rgb(185_138_43)]'
                  : ''
            }`}
          >
            {r.lat}
          </span>
          <span className="font-mono text-[10.5px] text-ink-muted">{r.ts}</span>
        </div>
      ))}
    </div>
  )
}
