'use client'

/**
 * /admin/content-moderation — AdminShell-skinned moderation surface.
 *
 * We don't ship a real moderation pipeline yet. What we *can* do honestly is:
 *   • show the moderation block from /admin/settings and link to edit it
 *   • surface the heuristic "high-cost requests in the last 24h" from
 *     /api/admin/usage so admins can spot anomalies that *might* be abuse
 *
 * No fake flagged-content rows, no synthetic NSFW examples.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AdminShell, { AdminPanel } from '@/shared/ui/admin/AdminShell'

interface ModerationCfg {
  enabled: boolean
  auto_block_high_cost: boolean
  high_cost_threshold_usd: number
}
interface UsageRow {
  id: string
  created_at: string
  provider: string | null
  model: string
  chat_type: string
  cost_usd: number
  prompt_tokens: number
  completion_tokens: number
  user: { name: string; email: string }
}

export default function ModerationPage() {
  const [mod, setMod] = useState<ModerationCfg | null>(null)
  const [highCost, setHighCost] = useState<UsageRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { settings?: { moderation?: ModerationCfg } }) => {
        if (cancelled) return
        setMod(
          j.settings?.moderation ?? {
            enabled: false,
            auto_block_high_cost: false,
            high_cost_threshold_usd: 1,
          },
        )
      })
      .catch(() => {
        if (!cancelled) {
          setMod({ enabled: false, auto_block_high_cost: false, high_cost_threshold_usd: 1 })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mod) return
    let cancelled = false
    const params = new URLSearchParams({
      since: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      min_cost: String(mod.high_cost_threshold_usd ?? 1),
      limit: '40',
      enrich_users: '1',
    })
    fetch(`/api/admin/usage?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { entries?: UsageRow[] }) => {
        if (!cancelled) setHighCost(j.entries ?? [])
      })
      .catch(() => {
        if (!cancelled) setHighCost([])
      })
    return () => {
      cancelled = true
    }
  }, [mod])

  const status = mod
    ? mod.enabled ? 'enabled' : 'disabled'
    : '…'

  return (
    <AdminShell
      crumb={['admin', 'trust']}
      here="Content moderation"
      eyebrow="trust & safety · honest signals"
      heading={<>Catch the calls that <em className="italic">don&apos;t look right.</em></>}
      lead="There's no full moderation pipeline yet. Until there is, this surface tells you exactly what we can see today: the moderation block from your platform settings, plus the cost-threshold heuristic — requests above the dollar bar you configured."
      syncHint={mod ? `pipeline ${status}` : 'syncing…'}
    >
      <AdminPanel
        title="Moderation status"
        meta="configure thresholds in /admin/settings"
        toolbar={
          <div className="px-[18px] py-2 border-b border-hairline-soft flex items-center justify-end min-h-[28px]">
            <Link
              href="/admin/settings"
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent underline-offset-4 hover:underline"
            >
              edit settings →
            </Link>
          </div>
        }
      >
        {mod === null ? (
          <div className="px-[18px] py-6 font-mono text-[11px] text-ink-muted">loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3">
            <StatBlock
              label="Pipeline"
              value={mod.enabled ? 'enabled' : 'disabled'}
              tone={mod.enabled ? 'green' : 'idle'}
            />
            <StatBlock
              label="Auto-block high cost"
              value={mod.auto_block_high_cost ? 'on' : 'off'}
              tone={mod.auto_block_high_cost ? 'amber' : 'idle'}
            />
            <StatBlock
              label="Threshold"
              value={`$${(mod.high_cost_threshold_usd ?? 0).toFixed(2)}`}
              tone="idle"
            />
          </div>
        )}
      </AdminPanel>

      <AdminPanel
        title="High-cost requests · last 24h"
        meta={
          mod
            ? `≥ $${(mod.high_cost_threshold_usd ?? 1).toFixed(2)} per call`
            : '…'
        }
        toolbar={
          highCost ? (
            <div className="px-[18px] py-2 border-b border-hairline-soft flex items-center justify-end min-h-[28px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
                {highCost.length} found
              </span>
            </div>
          ) : undefined
        }
      >
        {highCost === null ? (
          <div className="px-[18px] py-6 font-mono text-[11px] text-ink-muted">loading…</div>
        ) : highCost.length === 0 ? (
          <div className="px-[18px] py-8 font-mono text-[11.5px] text-ink-muted">
            no high-cost requests in the last 24 hours.
          </div>
        ) : (
          <div className="divide-y divide-hairline-soft">
            <div className="px-[18px] py-2 grid grid-cols-[1.4fr_1fr_1fr_auto] gap-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
              <div>User</div>
              <div>Model</div>
              <div>Type</div>
              <div className="text-right">Cost</div>
            </div>
            {highCost.map(r => (
              <div
                key={r.id}
                className="px-[18px] py-2.5 grid grid-cols-[1.4fr_1fr_1fr_auto] gap-3 items-baseline"
              >
                <div className="min-w-0">
                  <div className="font-serif italic text-[14px] truncate">
                    {r.user.name || r.user.email.split('@')[0] || '—'}
                  </div>
                  <div className="font-mono text-[10.5px] text-ink-muted truncate">
                    {r.user.email}
                  </div>
                </div>
                <div className="font-mono text-[11px] text-ink truncate">{r.model}</div>
                <div className="font-mono text-[11px] text-ink-muted">{r.chat_type}</div>
                <div className="font-mono text-[11px] text-ink text-right">
                  ${r.cost_usd.toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminPanel>

      <AdminPanel title="What this surface doesn't do yet" meta="set expectations honestly">
        <div className="px-[18px] py-4 font-mono text-[11.5px] text-ink-muted leading-[1.6]">
          A real moderation pipeline (NSFW image classifier, toxic-text flags, manual review queue)
          isn&apos;t wired yet. Until it is, this page surfaces the only signal we have today: requests
          that exceed the cost threshold you set in{' '}
          <Link
            href="/admin/settings"
            className="text-accent underline-offset-2 hover:underline"
          >
            platform settings
          </Link>
          . Approval / removal actions are intentionally absent rather than fake.
        </div>
      </AdminPanel>
    </AdminShell>
  )
}

/* ───────── Atom ───────── */

function StatBlock({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'green' | 'amber' | 'red' | 'idle'
}) {
  const dot =
    tone === 'green'
      ? 'bg-[rgb(47_143_95)]'
      : tone === 'amber'
        ? 'bg-accent'
        : tone === 'red'
          ? 'bg-[rgb(184_61_61)]'
          : 'bg-ink-soft'
  return (
    <div className="px-[18px] py-4 border-r border-hairline-soft last:border-r-0">
      <div className="flex items-center gap-2">
        <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">
          {label}
        </span>
      </div>
      <div className="font-serif italic text-[24px] mt-1 text-ink">{value}</div>
    </div>
  )
}
