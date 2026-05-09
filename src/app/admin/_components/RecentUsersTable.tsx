'use client'

/**
 * RecentUsersTable — paneled table with toolbar (filters + search) and
 * editorial-styled rows (avatar blob, plan chip, mono numerals, status dot).
 *
 * Currently uses a static demo set; swapping in a real Supabase query is a
 * one-line change in `useEffect` once an admin API for user listing exists.
 */

import { useMemo, useState } from 'react'
import { AdminFilter } from '@/shared/ui/admin/AdminShell'

type Plan = 'studio' | 'pro' | 'free'
type Status = 'green' | 'amber' | 'red'
type User = {
  n: string
  e: string
  plan: Plan
  ws: string
  tk: string
  sp: string
  s: Status
  /** Avatar background tone: b1=ink, b2=accent, b3=green, b4=blue, b5=ochre */
  a: 'b1' | 'b2' | 'b3' | 'b4' | 'b5'
  i: string
}

const USERS: User[] = [
  { n: 'Elena Marchetti', e: 'elena@aperture.press', plan: 'studio', ws: 'aperture-press', tk: '18.2M', sp: '$1,840', s: 'green', a: 'b1', i: 'e' },
  { n: 'Cassian Vellum', e: 'cv@marginalia.co', plan: 'studio', ws: 'marginalia-co', tk: '14.1M', sp: '$1,220', s: 'green', a: 'b2', i: 'c' },
  { n: 'Ines Goyal', e: 'ines@northbound.dev', plan: 'pro', ws: 'northbound', tk: '5.4M', sp: '$ 412', s: 'green', a: 'b3', i: 'i' },
  { n: 'Petra Lindh', e: 'petra@faraday.press', plan: 'pro', ws: 'faraday-press', tk: '3.1M', sp: '$ 248', s: 'amber', a: 'b4', i: 'p' },
  { n: 'Wren Okafor', e: 'wren@stoa.studio', plan: 'studio', ws: 'stoa-studio', tk: '9.8M', sp: '$ 904', s: 'green', a: 'b5', i: 'w' },
  { n: 'Tomás Beneš', e: 'tomas@quartermaster.io', plan: 'pro', ws: 'quartermaster', tk: '2.6M', sp: '$ 198', s: 'green', a: 'b1', i: 't' },
  { n: 'Hadiya Reyes', e: 'hadiya@aperture.press', plan: 'studio', ws: 'aperture-press', tk: '7.4M', sp: '$ 712', s: 'red', a: 'b2', i: 'h' },
  { n: 'Soren Mistry', e: 'soren@marginalia.co', plan: 'pro', ws: 'marginalia-co', tk: '1.2M', sp: '$  92', s: 'green', a: 'b3', i: 's' },
  { n: 'Marlowe Sato', e: 'marlowe@aperture.press', plan: 'pro', ws: 'aperture-press', tk: '8.0M', sp: '$ 624', s: 'green', a: 'b4', i: 'm' },
]

const AV_BG: Record<User['a'], string> = {
  b1: '#2C2A24',
  b2: '#A8472A',
  b3: '#2F8F5F',
  b4: '#1F4663',
  b5: '#6B5B2F',
}

const STATUS_LABEL: Record<Status, string> = {
  green: 'active',
  amber: 'flagged',
  red: 'over quota',
}

const FILTERS = ['all', 'studio', 'pro', 'free', 'flagged'] as const
type Filter = (typeof FILTERS)[number]

export default function RecentUsersTable() {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    return USERS.filter(u => {
      if (filter === 'flagged' && u.s === 'green') return false
      if (filter !== 'all' && filter !== 'flagged' && u.plan !== filter) return false
      if (!query) return true
      const q = query.toLowerCase()
      return (
        u.n.toLowerCase().includes(q) ||
        u.e.toLowerCase().includes(q) ||
        u.ws.toLowerCase().includes(q)
      )
    })
  }, [filter, query])

  return (
    <div className="flex flex-col">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-3 px-[18px] py-3 border-b border-hairline-soft">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(f => (
            <AdminFilter key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f}
            </AdminFilter>
          ))}
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1.5 border border-hairline-soft rounded-sharp bg-surface min-w-[220px] font-mono text-[11px]">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-ink-muted">
            <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.1" />
            <path d="m7 7 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="search by email, workspace, id…"
            className="flex-1 bg-transparent outline-none border-0 font-mono text-[11px] text-ink placeholder:text-ink-muted"
          />
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr>
              {['User', 'Plan', 'Workspace', 'Tokens (30d)', '$ spent', 'Status', ''].map((h, i) => (
                <th
                  key={i}
                  className={`text-left font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted font-normal px-4 py-3 border-b border-hairline bg-rail-soft ${
                    h === 'Tokens (30d)' || h === '$ spent' ? 'text-right' : ''
                  } ${i === 0 ? 'w-[28%]' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, idx) => (
              <tr
                key={u.e}
                className={`hover:bg-rail-soft transition-colors ${
                  idx === filtered.length - 1 ? '' : ''
                }`}
              >
                <td className="px-4 py-2.5 border-b border-hairline-soft align-middle">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-serif italic text-[13px] text-bg flex-shrink-0"
                      style={{ background: AV_BG[u.a] }}
                      aria-hidden
                    >
                      {u.i}
                    </span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{u.n}</div>
                      <div className="font-mono text-[11px] text-ink-muted truncate">{u.e}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 border-b border-hairline-soft align-middle">
                  <PlanChip plan={u.plan} />
                </td>
                <td className="px-4 py-2.5 border-b border-hairline-soft align-middle">
                  <span className="font-mono text-[11px]">{u.ws}</span>
                </td>
                <td className="px-4 py-2.5 border-b border-hairline-soft align-middle text-right font-mono text-[12px]">
                  {u.tk}
                </td>
                <td className="px-4 py-2.5 border-b border-hairline-soft align-middle text-right font-mono text-[12px]">
                  {u.sp}
                </td>
                <td className="px-4 py-2.5 border-b border-hairline-soft align-middle">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-ink-soft">
                    <StatusDot tone={u.s} />
                    {STATUS_LABEL[u.s]}
                  </span>
                </td>
                <td className="px-4 py-2.5 border-b border-hairline-soft align-middle text-right">
                  <button
                    type="button"
                    title="Open"
                    className="w-[26px] h-[26px] inline-flex items-center justify-center border border-hairline-soft rounded-sharp text-ink-soft hover:border-ink hover:text-ink transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path
                        d="M3 1.5h6.5V8M9.5 1.5 1.5 9.5"
                        stroke="currentColor"
                        strokeWidth="1.1"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center font-mono text-[11px] text-ink-muted">
                  no users match
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlanChip({ plan }: { plan: Plan }) {
  const cls =
    plan === 'studio'
      ? 'text-bg bg-ink border-ink'
      : plan === 'pro'
        ? 'text-ink border-ink'
        : 'text-ink-soft border-hairline'
  return (
    <span
      className={`inline-flex items-center font-mono text-[10.5px] tracking-[0.06em] px-2 py-0.5 border rounded-sharp ${cls}`}
    >
      {plan}
    </span>
  )
}

function StatusDot({ tone }: { tone: Status }) {
  const bg =
    tone === 'green'
      ? 'rgb(47 143 95)'
      : tone === 'amber'
        ? 'rgb(185 138 43)'
        : 'rgb(181 58 40)'
  return <span className="w-1.5 h-1.5 rounded-full" style={{ background: bg }} aria-hidden />
}
