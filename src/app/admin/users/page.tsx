'use client'

/**
 * /admin/users — full user index.
 *
 * Pulls /api/admin/users, supports a server-side `q` search and a role
 * filter, and renders every row with the same avatar + role chip + 30d
 * usage + balance signals as the dashboard's RecentUsersTable. Click a row
 * to expand a side detail panel inline.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminShell, {
  AdminBtn,
  AdminFilter,
  AdminIconBtn,
  AdminPanel,
} from '@/shared/ui/admin/AdminShell'

interface User {
  id: string
  email: string
  name: string
  role: string | null
  company: string | null
  country: string | null
  city: string | null
  created_at: string
  balance_usd: number
  usage_30d: { spend: number; tokens: number; calls: number }
}

const ROLE_FILTERS = ['all', 'super_admin', 'admin', 'member'] as const
type RoleFilter = (typeof ROLE_FILTERS)[number]

const AV_BG = ['#2C2A24', '#A8472A', '#2F8F5F', '#1F4663', '#6B5B2F']

export default function UsersPage() {
  const router = useRouter()
  const params = useSearchParams()
  const initialId = params.get('id')

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const [role, setRole] = useState<RoleFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(initialId)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const search = new URLSearchParams()
    search.set('limit', '300')
    if (role !== 'all') search.set('role', role)
    if (query.trim()) search.set('q', query.trim())
    fetch(`/api/admin/users?${search.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { users?: User[] }) => { if (!cancelled) setUsers(j.users ?? []) })
      .catch(e => console.error('[v0] /admin/users fetch failed', e))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [role, query, refreshTick])

  const totalSpend = useMemo(() => users.reduce((s, u) => s + u.usage_30d.spend, 0), [users])
  const totalBalance = useMemo(() => users.reduce((s, u) => s + u.balance_usd, 0), [users])
  const selected = users.find(u => u.id === selectedId) ?? null

  return (
    <AdminShell
      crumb={['admin', 'people']}
      here="Users"
      eyebrow="every account on the platform"
      heading={<>Who&apos;s on, <em className="italic">and what they&apos;re doing.</em></>}
      lead="Search by name, email, or company. Filter by role. Click a row to inspect a single account, see balance, and review their last 30 days of activity."
      headExtra={ROLE_FILTERS.map(r => (
        <AdminFilter key={r} active={role === r} onClick={() => setRole(r)}>
          {r.replace('_', ' ')}
        </AdminFilter>
      ))}
      syncHint={loading ? 'syncing…' : `${users.length} accounts shown`}
      actions={
        <>
          <AdminIconBtn title="Refresh" onClick={() => setRefreshTick(t => t + 1)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M11 6.5a4.5 4.5 0 1 1-1.32-3.18M11 1.5v3H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </AdminIconBtn>
          <AdminBtn primary onClick={() => router.push('/admin/billing')}>billing →</AdminBtn>
        </>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-hairline rounded-card bg-surface mb-[18px]">
        <KpiCell label="Accounts (filtered)" value={users.length.toLocaleString()} />
        <KpiCell label="Spend (30d, filtered)" value={`$${totalSpend.toFixed(2)}`} />
        <KpiCell label="Outstanding balance" value={`$${totalBalance.toFixed(2)}`} accent />
        <KpiCell label="Active in 30d" value={users.filter(u => u.usage_30d.calls > 0).length.toLocaleString()} />
      </div>

      <div className={`grid gap-[18px] ${selected ? 'xl:grid-cols-[1fr_360px]' : 'grid-cols-1'}`}>
        <AdminPanel
          title="Accounts"
          meta={`${users.length} ${users.length === 1 ? 'row' : 'rows'}`}
          toolbar={
            <div className="flex items-center justify-between gap-3 px-[18px] py-3 border-b border-hairline-soft">
              <div className="flex items-center gap-2 px-2.5 py-1.5 border border-hairline-soft rounded-sharp bg-surface w-full max-w-[420px] font-mono text-[11px]">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-ink-muted">
                  <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.1" />
                  <path d="m7 7 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="search by name, email, company…"
                  className="flex-1 bg-transparent outline-none border-0 font-mono text-[11px] text-ink placeholder:text-ink-muted"
                />
              </div>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr>
                  {['User', 'Role', 'Joined', 'Calls (30d)', '$ spent', 'Balance', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`text-left font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted font-normal px-4 py-3 border-b border-hairline bg-rail-soft ${
                        h === 'Calls (30d)' || h === '$ spent' || h === 'Balance' ? 'text-right' : ''
                      } ${i === 0 ? 'w-[28%]' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center font-mono text-[11px] text-ink-muted">loading users…</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center font-mono text-[11px] text-ink-muted">no users match</td></tr>
                ) : users.map(u => {
                  const initial = (u.name || u.email || '·').charAt(0).toLowerCase()
                  const tone = AV_BG[hashIndex(u.id, AV_BG.length)]
                  const isSelected = u.id === selectedId
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedId(isSelected ? null : u.id)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-rail-soft' : 'hover:bg-rail-soft'}`}
                    >
                      <td className="px-4 py-2.5 border-b border-hairline-soft align-middle">
                        <div className="flex items-center gap-2.5">
                          <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-serif italic text-[13px] text-bg flex-shrink-0" style={{ background: tone }} aria-hidden>
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
                        {u.usage_30d.calls}
                      </td>
                      <td className="px-4 py-2.5 border-b border-hairline-soft align-middle text-right font-mono text-[12px]">
                        ${u.usage_30d.spend.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 border-b border-hairline-soft align-middle text-right font-mono text-[12px]">
                        ${u.balance_usd.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 border-b border-hairline-soft align-middle text-right">
                        <span className="font-mono text-[10.5px] text-ink-muted">{isSelected ? '—' : '+'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </AdminPanel>

        {selected && (
          <AdminPanel title={selected.name} meta={selected.email}>
            <div className="px-[18px] py-4 space-y-4">
              <Detail label="Role" value={(selected.role ?? 'member').replace('_', ' ')} />
              <Detail label="Company" value={selected.company ?? '—'} />
              <Detail
                label="Location"
                value={[selected.city, selected.country].filter(Boolean).join(', ') || '—'}
              />
              <Detail label="Joined" value={`${formatDate(selected.created_at)} · ${daysAgo(selected.created_at)}`} />
              <div className="border-t border-hairline-soft pt-4">
                <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted mb-2">last 30 days</div>
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="calls" value={selected.usage_30d.calls.toString()} />
                  <Stat label="tokens" value={formatCount(selected.usage_30d.tokens)} />
                  <Stat label="spend" value={`$${selected.usage_30d.spend.toFixed(2)}`} />
                </div>
              </div>
              <div className="border-t border-hairline-soft pt-4">
                <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted mb-2">credits</div>
                <div className="font-serif italic text-[28px] leading-none">${selected.balance_usd.toFixed(2)}</div>
                <div className="font-mono text-[10.5px] text-ink-muted mt-1">current balance</div>
              </div>
              <div className="pt-2">
                <AdminBtn onClick={() => router.push(`/admin/billing?user=${selected.id}`)}>view invoices</AdminBtn>
              </div>
            </div>
          </AdminPanel>
        )}
      </div>
    </AdminShell>
  )
}

function KpiCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-5 py-[18px] border-r border-hairline-soft last:border-r-0">
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">{label}</div>
      <div className={`font-serif text-[28px] leading-none tracking-[-0.02em] mt-1.5 ${accent ? 'italic text-accent' : ''}`}>{value}</div>
    </div>
  )
}

function RoleChip({ role }: { role: string }) {
  const cls = role === 'super_admin'
    ? 'text-bg bg-ink border-ink'
    : role === 'admin' ? 'text-ink border-ink'
      : 'text-ink-soft border-hairline'
  return (
    <span className={`inline-flex items-center font-mono text-[10.5px] tracking-[0.06em] px-2 py-0.5 border rounded-sharp ${cls}`}>
      {role.replace('_', ' ')}
    </span>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">{label}</div>
      <div className="text-[13px] mt-1">{value}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-serif italic text-[18px] leading-none">{value}</div>
      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted mt-1">{label}</div>
    </div>
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
  } catch { return '—' }
}
function formatDate(iso: string): string {
  try { return new Date(iso).toISOString().slice(0, 10) } catch { return '—' }
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
