'use client'

/**
 * RecentUsersTable — paneled table fed by /api/admin/users?limit=12.
 *
 * Toolbar keeps the same filter chips + search input (now applied to the
 * fetched rows client-side so refresh is instant). Avatar is a solid ink
 * blob with the user's first-letter; rows show role + spend + balance.
 *
 * A "view all users" link in the empty footer routes to /admin/users.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminFilter } from '@/shared/ui/admin/AdminShell'

interface User {
  id: string
  email: string
  name: string
  role: string | null
  company: string | null
  created_at: string
  balance_usd: number
  usage_30d: { spend: number; tokens: number; calls: number }
}

const FILTERS = ['all', 'super_admin', 'member', 'flagged'] as const
type Filter = (typeof FILTERS)[number]

const AV_BG = ['#2C2A24', '#A8472A', '#2F8F5F', '#1F4663', '#6B5B2F']

export default function RecentUsersTable() {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/admin/users?limit=12', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { users?: User[] }) => { if (!cancelled) setUsers(j.users ?? []) })
      .catch(e => console.error('[v0] /admin/users fetch failed', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (filter === 'flagged') {
        // No formal flag system yet — surrogate: anyone over 50% of seed credit
        // (i.e. real spenders) so the chip has some signal beyond aesthetics.
        if (u.usage_30d.spend < 5) return false
      } else if (filter !== 'all' && (u.role ?? 'member') !== filter) return false
      if (!query) return true
      const q = query.toLowerCase()
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.company ?? '').toLowerCase().includes(q)
      )
    })
  }, [users, filter, query])

  return (
    <div className="flex flex-col">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-3 px-[18px] py-3 border-b border-hairline-soft">
        <div className="flex items-center gap-2 flex-wrap">
          {FILTERS.map(f => (
            <AdminFilter key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f.replace('_', ' ')}
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
            placeholder="search by email, name, company…"
            className="flex-1 bg-transparent outline-none border-0 font-mono text-[11px] text-ink placeholder:text-ink-muted"
          />
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr>
              {['User', 'Role', 'Joined', 'Tokens (30d)', '$ spent', 'Balance', ''].map((h, i) => (
                <th
                  key={i}
                  className={`text-left font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted font-normal px-4 py-3 border-b border-hairline bg-rail-soft ${
                    h === 'Tokens (30d)' || h === '$ spent' || h === 'Balance' ? 'text-right' : ''
                  } ${i === 0 ? 'w-[28%]' : ''}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center font-mono text-[11px] text-ink-muted">
                  loading users…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center font-mono text-[11px] text-ink-muted">
                  {users.length === 0 ? 'no users yet — once people sign up they show here' : 'no users match'}
                </td>
              </tr>
            ) : filtered.map((u, idx) => {
              const initial = (u.name || u.email || '·').charAt(0).toLowerCase()
              const tone = AV_BG[hashIndex(u.id, AV_BG.length)]
              return (
                <tr key={u.id} className="hover:bg-rail-soft transition-colors">
                  <td className="px-4 py-2.5 border-b border-hairline-soft align-middle">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-serif italic text-[13px] text-bg flex-shrink-0"
                        style={{ background: tone }}
                        aria-hidden
                      >
                        {initial}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.name}</div>
                        <div className="font-mono text-[11px] text-ink-muted truncate">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft align-middle">
                    <RoleChip role={u.role ?? 'member'} />
                  </td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft align-middle">
                    <span className="font-mono text-[11px] text-ink-muted">{daysAgo(u.created_at)}</span>
                  </td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft align-middle text-right font-mono text-[12px]">
                    {formatCount(u.usage_30d.tokens)}
                  </td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft align-middle text-right font-mono text-[12px]">
                    ${u.usage_30d.spend.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft align-middle text-right font-mono text-[12px]">
                    ${u.balance_usd.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 border-b border-hairline-soft align-middle text-right">
                    <button
                      type="button"
                      title="Open"
                      onClick={() => router.push(`/admin/users?id=${u.id}`)}
                      className="w-[26px] h-[26px] inline-flex items-center justify-center border border-hairline-soft rounded-sharp text-ink-soft hover:border-ink hover:text-ink transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M3 1.5h6.5V8M9.5 1.5 1.5 9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* footer link */}
      {users.length > 0 && (
        <div className="px-[18px] py-3 border-t border-hairline-soft text-right">
          <button
            onClick={() => router.push('/admin/users')}
            className="font-mono text-[10.5px] tracking-[0.06em] text-ink-soft hover:text-ink transition-colors uppercase"
          >
            view all users →
          </button>
        </div>
      )}
    </div>
  )
}

function RoleChip({ role }: { role: string }) {
  const cls = role === 'super_admin'
    ? 'text-bg bg-ink border-ink'
    : role === 'admin'
      ? 'text-ink border-ink'
      : 'text-ink-soft border-hairline'
  return (
    <span className={`inline-flex items-center font-mono text-[10.5px] tracking-[0.06em] px-2 py-0.5 border rounded-sharp ${cls}`}>
      {role.replace('_', ' ')}
    </span>
  )
}

function daysAgo(iso: string): string {
  try {
    const d = new Date(iso).getTime()
    const days = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24))
    if (days < 1) return 'today'
    if (days === 1) return '1 day ago'
    if (days < 30) return `${days} days ago`
    if (days < 60) return '1 mo ago'
    return `${Math.floor(days / 30)} mo ago`
  } catch {
    return '—'
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function hashIndex(s: string, mod: number): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % mod
}
