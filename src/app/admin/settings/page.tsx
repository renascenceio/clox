'use client'

/**
 * /admin/settings — Platform settings, persisted to admin_platform_settings.
 *
 * Four config blocks:
 *   • site         — name / support email / timezone
 *   • registration — open / invite-only / allowed domains list
 *   • limits       — free credit, request token cap, attachment cap
 *   • moderation   — enable + auto-block + cost threshold
 *
 * Toggles save instantly. Text inputs save on blur (or Enter). Every PATCH
 * appends to the audit log via the server route.
 */

import { useEffect, useState } from 'react'
import AdminShell, { AdminPanel } from '@/shared/ui/admin/AdminShell'

interface SiteCfg {
  name: string
  support_email: string
  timezone: string
}
interface RegistrationCfg {
  open: boolean
  invite_only: boolean
  allow_free_email_domains: boolean
  allowed_domains: string[]
}
interface LimitsCfg {
  free_credit_usd: number
  max_request_tokens: number
  max_attachment_mb: number
}
interface ModerationCfg {
  enabled: boolean
  auto_block_high_cost: boolean
  high_cost_threshold_usd: number
}

interface SettingsPayload {
  site: SiteCfg
  registration: RegistrationCfg
  limits: LimitsCfg
  moderation: ModerationCfg
}

const DEFAULTS: SettingsPayload = {
  site: { name: 'Clox', support_email: 'support@clox.com', timezone: 'UTC' },
  registration: {
    open: true,
    invite_only: false,
    allow_free_email_domains: true,
    allowed_domains: [],
  },
  limits: { free_credit_usd: 5, max_request_tokens: 16000, max_attachment_mb: 8 },
  moderation: { enabled: false, auto_block_high_cost: false, high_cost_threshold_usd: 1 },
}

export default function PlatformSettingsPage() {
  const [data, setData] = useState<SettingsPayload | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { settings?: Partial<SettingsPayload> }) => {
        if (cancelled) return
        const merged: SettingsPayload = {
          site: { ...DEFAULTS.site, ...(j.settings?.site ?? {}) },
          registration: { ...DEFAULTS.registration, ...(j.settings?.registration ?? {}) },
          limits: { ...DEFAULTS.limits, ...(j.settings?.limits ?? {}) },
          moderation: { ...DEFAULTS.moderation, ...(j.settings?.moderation ?? {}) },
        }
        setData(merged)
      })
      .catch(e => console.error('[v0] /admin/settings load failed', e))
    return () => { cancelled = true }
  }, [])

  async function saveBlock<K extends keyof SettingsPayload>(key: K, value: SettingsPayload[K]) {
    if (!data) return
    setSavingKey(key)
    setData({ ...data, [key]: value })
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key, value }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSavedFlash(key)
      setTimeout(() => setSavedFlash(null), 1800)
    } catch (e) {
      console.error('[v0] settings save failed', e)
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <AdminShell
      crumb={['admin', 'platform']}
      here="Settings"
      eyebrow="platform · audit logged"
      heading={<>The knobs that <em className="italic">shape every signup.</em></>}
      lead="Site identity, registration policy, default request limits, and moderation thresholds. Toggles save instantly; text inputs save on blur or Enter. Every change appends to the audit log."
      syncHint={savingKey ? `saving ${savingKey}…` : data ? 'in sync' : 'syncing…'}
    >
      {data === null ? (
        <AdminPanel title="loading" meta="reading platform settings">
          <div className="px-[18px] py-6 font-mono text-[11px] text-ink-muted">…</div>
        </AdminPanel>
      ) : (
        <>
          <SiteCard
            cfg={data.site}
            saving={savingKey === 'site'}
            saved={savedFlash === 'site'}
            onSave={v => saveBlock('site', v)}
          />
          <RegistrationCard
            cfg={data.registration}
            saving={savingKey === 'registration'}
            saved={savedFlash === 'registration'}
            onSave={v => saveBlock('registration', v)}
          />
          <LimitsCard
            cfg={data.limits}
            saving={savingKey === 'limits'}
            saved={savedFlash === 'limits'}
            onSave={v => saveBlock('limits', v)}
          />
          <ModerationCard
            cfg={data.moderation}
            saving={savingKey === 'moderation'}
            saved={savedFlash === 'moderation'}
            onSave={v => saveBlock('moderation', v)}
          />
        </>
      )}
    </AdminShell>
  )
}

/* ───────── Cards ───────── */

function SiteCard({
  cfg, saving, saved, onSave,
}: {
  cfg: SiteCfg; saving: boolean; saved: boolean; onSave: (v: SiteCfg) => void
}) {
  const [local, setLocal] = useState(cfg)
  useEffect(() => setLocal(cfg), [cfg])
  return (
    <AdminPanel
      title="Site"
      meta="public name · support email · timezone"
      toolbar={<PanelToolbar saving={saving} saved={saved} />}
    >
      <div className="divide-y divide-hairline-soft">
        <Row label="Site name">
          <TextField
            value={local.name}
            onChange={v => setLocal({ ...local, name: v })}
            onCommit={v => onSave({ ...local, name: v })}
          />
        </Row>
        <Row label="Support email">
          <TextField
            value={local.support_email}
            onChange={v => setLocal({ ...local, support_email: v })}
            onCommit={v => onSave({ ...local, support_email: v })}
            type="email"
          />
        </Row>
        <Row label="Timezone">
          <TextField
            value={local.timezone}
            onChange={v => setLocal({ ...local, timezone: v })}
            onCommit={v => onSave({ ...local, timezone: v })}
            placeholder="UTC"
          />
        </Row>
      </div>
    </AdminPanel>
  )
}

function RegistrationCard({
  cfg, saving, saved, onSave,
}: {
  cfg: RegistrationCfg; saving: boolean; saved: boolean; onSave: (v: RegistrationCfg) => void
}) {
  const [domainsText, setDomainsText] = useState((cfg.allowed_domains ?? []).join(', '))
  useEffect(() => setDomainsText((cfg.allowed_domains ?? []).join(', ')), [cfg.allowed_domains])
  function commitDomains(v: string) {
    const list = v.split(',').map(s => s.trim()).filter(Boolean)
    onSave({ ...cfg, allowed_domains: list })
  }
  return (
    <AdminPanel
      title="Registration"
      meta="who can sign up · allowed domains"
      toolbar={<PanelToolbar saving={saving} saved={saved} />}
    >
      <div className="divide-y divide-hairline-soft">
        <Row label="Open registration" hint="anyone with a valid email">
          <Toggle on={cfg.open} onChange={v => onSave({ ...cfg, open: v })} />
        </Row>
        <Row label="Invite-only" hint="overrides open registration when on">
          <Toggle on={cfg.invite_only} onChange={v => onSave({ ...cfg, invite_only: v })} />
        </Row>
        <Row label="Allow free-email domains" hint="gmail, outlook, etc.">
          <Toggle on={cfg.allow_free_email_domains} onChange={v => onSave({ ...cfg, allow_free_email_domains: v })} />
        </Row>
        <Row label="Allowed domains" hint="comma-separated; leave empty to allow any">
          <TextField
            value={domainsText}
            onChange={setDomainsText}
            onCommit={commitDomains}
            placeholder="acme.com, partner.io"
            wide
          />
        </Row>
      </div>
    </AdminPanel>
  )
}

function LimitsCard({
  cfg, saving, saved, onSave,
}: {
  cfg: LimitsCfg; saving: boolean; saved: boolean; onSave: (v: LimitsCfg) => void
}) {
  const [local, setLocal] = useState(cfg)
  useEffect(() => setLocal(cfg), [cfg])
  return (
    <AdminPanel
      title="Limits"
      meta="signup credit · per-request caps"
      toolbar={<PanelToolbar saving={saving} saved={saved} />}
    >
      <div className="divide-y divide-hairline-soft">
        <Row label="Free credit on signup" hint="USD">
          <TextField
            value={String(local.free_credit_usd)}
            onChange={v => setLocal({ ...local, free_credit_usd: parseFloat(v) || 0 })}
            onCommit={v => onSave({ ...local, free_credit_usd: parseFloat(v) || 0 })}
            type="number"
          />
        </Row>
        <Row label="Max request tokens" hint="combined system + user">
          <TextField
            value={String(local.max_request_tokens)}
            onChange={v => setLocal({ ...local, max_request_tokens: parseInt(v) || 0 })}
            onCommit={v => onSave({ ...local, max_request_tokens: parseInt(v) || 0 })}
            type="number"
          />
        </Row>
        <Row label="Max attachment size (MB)">
          <TextField
            value={String(local.max_attachment_mb)}
            onChange={v => setLocal({ ...local, max_attachment_mb: parseInt(v) || 0 })}
            onCommit={v => onSave({ ...local, max_attachment_mb: parseInt(v) || 0 })}
            type="number"
          />
        </Row>
      </div>
    </AdminPanel>
  )
}

function ModerationCard({
  cfg, saving, saved, onSave,
}: {
  cfg: ModerationCfg; saving: boolean; saved: boolean; onSave: (v: ModerationCfg) => void
}) {
  const [local, setLocal] = useState(cfg)
  useEffect(() => setLocal(cfg), [cfg])
  return (
    <AdminPanel
      title="Moderation"
      meta="threshold heuristics · full pipeline TBD"
      toolbar={<PanelToolbar saving={saving} saved={saved} />}
    >
      <div className="divide-y divide-hairline-soft">
        <Row label="Enable moderation" hint="surface flagged content in /admin/content-moderation">
          <Toggle on={cfg.enabled} onChange={v => onSave({ ...cfg, enabled: v })} />
        </Row>
        <Row label="Auto-block high-cost requests" hint="reject requests above the threshold">
          <Toggle on={cfg.auto_block_high_cost} onChange={v => onSave({ ...cfg, auto_block_high_cost: v })} />
        </Row>
        <Row label="High-cost threshold" hint="USD">
          <TextField
            value={String(local.high_cost_threshold_usd)}
            onChange={v => setLocal({ ...local, high_cost_threshold_usd: parseFloat(v) || 0 })}
            onCommit={v => onSave({ ...local, high_cost_threshold_usd: parseFloat(v) || 0 })}
            type="number"
          />
        </Row>
      </div>
    </AdminPanel>
  )
}

/* ───────── Atoms ───────── */

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="px-[18px] py-3 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[11.5px] tracking-[0.04em] text-ink">{label}</div>
        {hint && <div className="font-mono text-[10.5px] text-ink-muted mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`w-9 h-[18px] p-[1.5px] rounded-[10px] border inline-flex items-center transition-colors ${on ? 'bg-ink border-ink justify-end' : 'bg-transparent border-hairline justify-start'}`}
    >
      <span className={`block w-[13px] h-[13px] rounded-full ${on ? 'bg-bg' : 'bg-ink-soft'}`} />
    </button>
  )
}

function TextField({
  value, onChange, onCommit, type = 'text', placeholder, wide,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: (v: string) => void
  type?: 'text' | 'email' | 'number'
  placeholder?: string
  wide?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onCommit(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      placeholder={placeholder}
      className={`h-8 px-2 bg-bg border border-hairline rounded-sharp font-mono text-[11.5px] text-ink text-right outline-none focus:border-ink ${wide ? 'w-80' : 'w-48'}`}
    />
  )
}

function PanelToolbar({ saving, saved }: { saving: boolean; saved: boolean }) {
  return (
    <div className="px-[18px] py-2 border-b border-hairline-soft flex items-center justify-end min-h-[28px]">
      {saving ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted">saving…</span>
      ) : saved ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent">saved</span>
      ) : (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-soft">in sync</span>
      )}
    </div>
  )
}
