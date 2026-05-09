'use client'

/**
 * Super-admin dashboard.
 *
 * The KPI strip + spend-per-day chart + model mix + chat-type mix come from
 * `/api/admin/dashboard` (one round-trip). Live request feed pulls
 * `/api/admin/live` every 5 s. Recent users + feature flags fetch their own
 * data inside the child components so they can refresh independently.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell, {
  AdminBtn,
  AdminFilter,
  AdminIconBtn,
  AdminPanel,
} from '@/shared/ui/admin/AdminShell'
import UsageChart from './_components/UsageChart'
import LiveRequestFeed from './_components/LiveRequestFeed'
import RecentUsersTable from './_components/RecentUsersTable'
import SystemStatus from './_components/SystemStatus'
import FeatureFlags from './_components/FeatureFlags'
import ModelMix from './_components/ModelMix'

interface DashboardData {
  kpis: {
    total_users: number
    new_users_30d: number
    active_users_30d: number
    spend_30d_usd: number
    spend_delta_pct: number
    tokens_30d: number
    calls_30d: number
    mrr_usd: number
  }
  spend_by_day: Array<{ day: string; spend: number; calls: number }>
  model_mix_24h: Array<{ model: string; calls: number }>
  chat_type_mix_24h: Array<{ chat_type: string; calls: number }>
  providers_24h: Array<{ provider: string; calls_24h: number; cost_24h: number }>
}

/* ------------------------------------------------------------------ */
/* KPI                                                                 */
/* ------------------------------------------------------------------ */
function Sparkline({ points, color = '#18181A' }: { points: number[]; color?: string }) {
  if (points.length < 2) return null
  const max = Math.max(1, ...points)
  const path = points
    .map((v, i) => {
      const x = (i * 64) / (points.length - 1)
      const y = 22 - (v / max) * 22
      return `${i === 0 ? 'M' : 'L'}${x},${y.toFixed(2)}`
    })
    .join(' ')
  return (
    <svg viewBox="0 0 64 22" preserveAspectRatio="none" className="absolute right-4 bottom-4 w-16 h-[22px]" aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth="1" />
    </svg>
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}
function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(2)}`
}

const TAB_LABELS = ['Overview', 'Users', 'Models', 'Feature flags', 'Audit log', 'Billing'] as const
type TabLabel = (typeof TAB_LABELS)[number]

const TAB_HREF: Record<TabLabel, string | null> = {
  Overview: null,
  Users: '/admin/users',
  Models: '/admin/api-keys',
  'Feature flags': '/admin/flags',
  'Audit log': '/admin/audit',
  Billing: '/admin/billing',
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [activeWindow, setActiveWindow] = useState<'30d' | '7d' | '24h'>('30d')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const [lastSync, setLastSync] = useState('')

  // Fetch dashboard payload on mount + whenever the user hits Refresh.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch('/api/admin/dashboard', { cache: 'no-store' })
        if (!res.ok) throw new Error(`dashboard ${res.status}`)
        const j = (await res.json()) as DashboardData
        if (!cancelled) {
          setData(j)
          setLastSync(new Date().toTimeString().slice(0, 8))
        }
      } catch (e) {
        console.error('[v0] /admin dashboard fetch failed:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [refreshTick])

  // Filter the spend-per-day series to the selected window.
  const filteredDays = useMemo(() => {
    if (!data) return []
    const slice = activeWindow === '30d' ? 30 : activeWindow === '7d' ? 7 : 1
    return data.spend_by_day.slice(-slice)
  }, [data, activeWindow])

  const kpis = data?.kpis
  const userCountLabel = kpis ? kpis.total_users.toLocaleString() : '—'

  /* ----- KPI strip rendering ------------------------------------- */
  const sparkUsers: number[] = []  // we don't track per-day signups; flat 0
  const sparkSpend = filteredDays.map(d => d.spend)
  const sparkCalls = filteredDays.map(d => d.calls)

  return (
    <AdminShell
      crumb={['admin', 'overview']}
      here="Dashboard"
      eyebrow={`superadmin · all workspaces · ${activeWindow === '30d' ? 'last 30d' : activeWindow}`}
      heading={<>Everything that happens, <em className="italic">at a glance.</em></>}
      lead="Live posture of the Clox platform — usage, cost, who's on, what's broken. Calm by default; lean in when something needs you."
      headExtra={(['30d', '7d', '24h'] as const).map(w => (
        <AdminFilter key={w} active={activeWindow === w} onClick={() => setActiveWindow(w)}>
          {w === '30d' ? 'last 30 days' : w}
        </AdminFilter>
      ))}
      tabs={TAB_LABELS.map(label => ({
        label,
        active: label === 'Overview',
        onClick: () => {
          const href = TAB_HREF[label]
          if (href) router.push(href)
        },
        pill: label === 'Users' ? { text: userCountLabel } : undefined,
      }))}
      syncHint={loading ? 'syncing…' : `last sync ${lastSync} · live`}
      actions={
        <>
          <AdminIconBtn title="Refresh" onClick={() => setRefreshTick(t => t + 1)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M11 6.5a4.5 4.5 0 1 1-1.32-3.18M11 1.5v3H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </AdminIconBtn>
          <AdminIconBtn title="Export CSV" onClick={() => router.push('/admin/usage')}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1.5v7M3.5 5l3 3 3-3M2 11h9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </AdminIconBtn>
          <AdminBtn primary onClick={() => router.push('/admin/api-keys')}>+ Manage models</AdminBtn>
        </>
      }
    >
      {/* ============================== KPIs ============================== */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 border border-hairline rounded-card bg-surface" role="group" aria-label="Key metrics">
        <KpiCell
          label="Active users (30d)"
          value={kpis ? formatCount(kpis.active_users_30d) : '—'}
          delta={kpis ? `+${kpis.new_users_30d} new` : ''}
          spark={sparkUsers}
          emphasis
        />
        <KpiCell
          label="Calls (30d)"
          value={kpis ? formatCount(kpis.calls_30d) : '—'}
          delta={kpis ? `${kpis.spend_delta_pct >= 0 ? '↑' : '↓'} ${Math.abs(kpis.spend_delta_pct)}% vs prev`
            : ''}
          deltaDown={kpis ? kpis.spend_delta_pct < 0 : false}
          spark={sparkCalls}
        />
        <KpiCell
          label="Tokens (30d)"
          value={kpis ? formatCount(kpis.tokens_30d) : '—'}
          delta=""
          spark={sparkCalls}
        />
        <KpiCell
          label="Spend (30d)"
          value={kpis ? formatUsd(kpis.spend_30d_usd) : '—'}
          delta={kpis ? `${kpis.spend_delta_pct >= 0 ? '↑' : '↓'} ${Math.abs(kpis.spend_delta_pct)}% vs prev`
            : ''}
          deltaDown={kpis ? kpis.spend_delta_pct > 0 : false}
          spark={sparkSpend}
          sparkColor="rgb(168 71 42)"
        />
        <KpiCell
          label="MRR"
          value={kpis ? formatUsd(kpis.mrr_usd) : '—'}
          delta=""
          spark={[]}
          emphasis
          sparkColor="rgb(168 71 42)"
        />
      </div>

      {/* ============================== Cols 1 ============================== */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-[18px] mt-[18px]">
        <AdminPanel title="Spend — last 30 days" meta="USD · daily">
          <UsageChart days={data?.spend_by_day ?? []} />
        </AdminPanel>
        <AdminPanel title="Live requests" meta="streaming · auto-refresh">
          <LiveRequestFeed />
        </AdminPanel>
      </div>

      {/* ============================== Cols 2 ============================== */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-[18px] mt-[18px]">
        <AdminPanel title="Recent users" meta={kpis ? `${kpis.total_users.toLocaleString()} total` : ''}>
          <RecentUsersTable />
        </AdminPanel>
        <AdminPanel title="System status" meta="usage signals · 30d">
          <SystemStatus
            calls30d={kpis?.calls_30d ?? 0}
            activeUsers30d={kpis?.active_users_30d ?? 0}
            providers={data?.providers_24h ?? []}
          />
        </AdminPanel>
      </div>

      {/* ============================== Split ============================== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-[18px] mt-[18px]">
        <AdminPanel title="Feature flags" meta="server-side gates">
          <FeatureFlags />
        </AdminPanel>
        <AdminPanel title="Model mix" meta="last 24h · share of completions">
          <ModelMix entries={data?.model_mix_24h ?? []} />
        </AdminPanel>
      </div>
    </AdminShell>
  )
}

function KpiCell({
  label, value, delta, deltaDown, spark, emphasis, sparkColor,
}: {
  label: string
  value: string
  delta: string
  deltaDown?: boolean
  spark: number[]
  emphasis?: boolean
  sparkColor?: string
}) {
  return (
    <div className="relative px-5 py-[18px] flex flex-col gap-0.5 border-r border-hairline-soft last:border-r-0">
      <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">{label}</span>
      <span className="font-serif text-[34px] leading-none tracking-[-0.02em] mt-1.5">
        {emphasis ? <em className="italic text-accent">{value}</em> : value}
      </span>
      {delta && (
        <span className={`font-mono text-[10.5px] tracking-[0.04em] mt-1 ${deltaDown ? 'text-[rgb(181_58_40)]' : 'text-[rgb(47_143_95)]'}`}>
          {delta}
        </span>
      )}
      <Sparkline points={spark} color={sparkColor} />
    </div>
  )
}
