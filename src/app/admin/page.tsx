'use client'

/**
 * Super-Admin Dashboard — Pearl & Onyx editorial style.
 *
 * Layout (top → bottom):
 *   1. AdminShell chrome (rail · top strip · page-head · tabs)
 *   2. KPI strip — 5 metric cells with serif numerals + 64×22 sparklines
 *   3. Cols (1.6fr 1fr) — stacked-area usage chart  ·  live request feed
 *   4. Cols (1.6fr 1fr) — recent users table        ·  system status
 *   5. Split (1fr 1fr) — feature flags              ·  model mix
 *
 * Data: most panels render mocked-but-believable data so the dashboard
 * looks alive in dev. Real Supabase data (auth users) is fetched
 * best-effort and falls back gracefully when the client lacks admin scope.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------
type Kpi = {
  label: string
  value: string
  emphasis?: boolean
  delta: string
  deltaDown?: boolean
  spark: number[]
  sparkColor?: string
}

const KPIS: Kpi[] = [
  {
    label: 'Active users',
    value: '12,431',
    emphasis: true,
    delta: '↑ 8.2% vs prev 30d',
    spark: [16, 14, 15, 12, 13, 9, 11, 7, 8, 4, 6, 3],
  },
  {
    label: 'Chats / day',
    value: '88,204',
    delta: '↑ 12.4%',
    spark: [18, 16, 17, 12, 14, 10, 12, 9, 11, 5, 7, 4],
  },
  {
    label: 'Tokens / day',
    value: '1.84B',
    delta: '↑ 6.1%',
    spark: [12, 14, 10, 11, 7, 9, 6, 8, 5, 7, 4, 5],
  },
  {
    label: 'p95 latency',
    value: '412 ms',
    delta: '↑ 38ms vs SLO',
    deltaDown: true,
    spark: [14, 12, 13, 11, 12, 10, 11, 8, 9, 5, 4, 3],
    sparkColor: 'rgb(181 58 40)',
  },
  {
    label: 'MRR',
    value: '$284,120',
    emphasis: true,
    delta: '↑ $18.2k',
    spark: [18, 17, 15, 16, 13, 12, 10, 11, 8, 7, 5, 3],
    sparkColor: 'rgb(168 71 42)',
  },
]

function Sparkline({ points, color = '#18181A' }: { points: number[]; color?: string }) {
  const path = points.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * 64) / (points.length - 1)},${y}`).join(' ')
  return (
    <svg
      viewBox="0 0 64 22"
      preserveAspectRatio="none"
      className="absolute right-4 bottom-4 w-16 h-[22px]"
      aria-hidden
    >
      <path d={path} fill="none" stroke={color} strokeWidth="1" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Tabs (visual only for now — Dashboard is the only built page so far).
// ---------------------------------------------------------------------------
const TAB_LABELS = [
  'Overview',
  'Users',
  'Workspaces',
  'Models',
  'Feature flags',
  'Audit log',
  'Billing',
] as const
type TabLabel = (typeof TAB_LABELS)[number]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminDashboardPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabLabel>('Overview')
  const [activeWindow, setActiveWindow] = useState<'30d' | '7d' | '24h'>('30d')
  const [userCount, setUserCount] = useState<number | null>(null)
  const [lastSync, setLastSync] = useState<string>('')

  // Best-effort live user count via supabase.auth.admin (will fail without
  // service role; that's fine, the rail/KPI fall back to the mocked total).
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.admin.listUsers()
        if (!cancelled && data?.users) setUserCount(data.users.length)
      } catch {
        // expected on non-service-role clients
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Tick the "last sync" hint once a second so the top strip feels live.
  useEffect(() => {
    const tick = () => {
      const t = new Date()
      setLastSync(t.toTimeString().slice(0, 8))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const userCountLabel = useMemo(() => {
    if (userCount == null) return '12,431'
    return userCount.toLocaleString()
  }, [userCount])

  // The dashboard page-head + top-strip configuration handed to AdminShell.
  return (
    <AdminShell
      crumb={['admin', 'overview']}
      here="Dashboard"
      eyebrow={`superadmin · all workspaces · ${activeWindow === '30d' ? 'last 30d' : activeWindow}`}
      heading={
        <>
          Everything that happens, <em className="italic">at a glance.</em>
        </>
      }
      lead="Live posture of the Clox platform — usage, cost, latency, who's on, what's broken. Calm by default; lean in when something needs you."
      headExtra={
        <>
          {(['30d', '7d', '24h'] as const).map(w => (
            <AdminFilter key={w} active={activeWindow === w} onClick={() => setActiveWindow(w)}>
              {w === '30d' ? 'last 30 days' : w}
            </AdminFilter>
          ))}
        </>
      }
      tabs={TAB_LABELS.map(label => ({
        label,
        active: activeTab === label,
        onClick: () => setActiveTab(label),
        pill:
          label === 'Users'
            ? { text: userCountLabel }
            : label === 'Workspaces'
              ? { text: '408' }
              : label === 'Audit log'
                ? { text: '3 new', tone: 'amber' }
                : undefined,
      }))}
      syncHint={`last sync ${lastSync} · live`}
      actions={
        <>
          <AdminIconBtn title="Refresh">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M11 6.5a4.5 4.5 0 1 1-1.32-3.18M11 1.5v3H8"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </AdminIconBtn>
          <AdminIconBtn title="Export CSV">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M6.5 1.5v7M3.5 5l3 3 3-3M2 11h9"
                stroke="currentColor"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </AdminIconBtn>
          <AdminBtn>⌘K&nbsp;&nbsp;jump</AdminBtn>
          <AdminBtn primary onClick={() => router.push('/admin/api-keys')}>
            + Manage models
          </AdminBtn>
        </>
      }
    >
      {/* ============================== KPIs ============================== */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 border border-hairline rounded-card bg-surface"
        role="group"
        aria-label="Key metrics"
      >
        {KPIS.map((k, i) => (
          <div
            key={k.label}
            className={`relative px-5 py-[18px] flex flex-col gap-0.5 ${
              i < KPIS.length - 1 ? 'border-r border-hairline-soft' : ''
            } ${i % 2 === 1 ? 'border-b md:border-b-0 border-hairline-soft' : ''}`}
          >
            <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">
              {k.label}
            </span>
            <span className="font-serif text-[34px] leading-none tracking-[-0.02em] mt-1.5">
              {k.emphasis ? <em className="italic text-accent">{k.value}</em> : k.value}
            </span>
            <span
              className={`font-mono text-[10.5px] tracking-[0.04em] mt-1 ${
                k.deltaDown ? 'text-[rgb(181_58_40)]' : 'text-[rgb(47_143_95)]'
              }`}
            >
              {k.delta}
            </span>
            <Sparkline points={k.spark} color={k.sparkColor} />
          </div>
        ))}
      </div>

      {/* ============================== Cols 1 ============================== */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-[18px] mt-[18px]">
        <AdminPanel title="Usage — by mode, last 30 days" meta="tokens (millions) · daily">
          <UsageChart />
        </AdminPanel>

        <AdminPanel title="Live requests" meta="streaming · 24/sec">
          <LiveRequestFeed />
        </AdminPanel>
      </div>

      {/* ============================== Cols 2 ============================== */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-[18px] mt-[18px]">
        <AdminPanel
          title="Recent users"
          meta={`${userCountLabel} total · 408 workspaces`}
        >
          <RecentUsersTable />
        </AdminPanel>

        <AdminPanel title="System status" meta="all regions · 7d">
          <SystemStatus />
        </AdminPanel>
      </div>

      {/* ============================== Split ============================== */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-[18px] mt-[18px]">
        <AdminPanel title="Feature flags" meta="14 flags · 3 rolling out">
          <FeatureFlags />
        </AdminPanel>

        <AdminPanel title="Model mix" meta="last 24h · share of completions">
          <ModelMix />
        </AdminPanel>
      </div>
    </AdminShell>
  )
}
