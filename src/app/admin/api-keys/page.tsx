'use client'

/**
 * Models — provider & API key management.
 *
 * This page lives at /admin/api-keys but presents itself as "Models" within
 * the super-admin rail. It preserves the existing provider-status logic
 * (env vars > AI Gateway > local key) and renders it inside the editorial
 * AdminShell — hairline cards, mono labels, serif provider names, the
 * single Terracotta accent for "live" states.
 */

import { useState, useEffect, useMemo } from 'react'
import { getAdminSettings, setProviderApiKey, setProviderEnabled } from '@/lib/admin-settings'
import { PROVIDERS, ProviderCategory } from '@/lib/providers'
import { useProviderStatus } from '@/lib/provider-status'
import { getModelsForProviderInCategory } from '@/lib/provider-models'
import AdminShell, {
  AdminBtn,
  AdminFilter,
  AdminIconBtn,
  AdminPanel,
} from '@/shared/ui/admin/AdminShell'

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  text: 'Text & chat',
  image: 'Image',
  video: 'Video',
  audio: 'Audio & voice',
}
const CATEGORY_ORDER: ProviderCategory[] = ['text', 'image', 'video', 'audio']

export default function ModelsAdminPage() {
  const { aiGatewayConnected, getState, refresh } = useProviderStatus()

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [enabledProviders, setEnabledProviders] = useState<Record<string, boolean>>({})
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [filter, setFilter] = useState<ProviderCategory | 'all'>('all')

  useEffect(() => {
    const settings = getAdminSettings()
    const keys: Record<string, string> = {}
    const enabled: Record<string, boolean> = {}
    PROVIDERS.forEach(p => {
      keys[p.id] = settings.providers[p.id]?.apiKey || ''
      enabled[p.id] = settings.providers[p.id]?.enabled ?? true
    })
    setApiKeys(keys)
    setEnabledProviders(enabled)
  }, [])

  const handleSaveKey = (providerId: string, apiKey: string) => {
    const trimmed = apiKey.trim()
    setProviderApiKey(providerId, trimmed)
    setApiKeys(prev => ({ ...prev, [providerId]: trimmed }))
    setEditingProvider(null)
    const name = PROVIDERS.find(p => p.id === providerId)?.name
    setSavedMessage(`${name} key saved`)
    setTimeout(() => setSavedMessage(null), 2500)
  }

  const handleToggleEnabled = (providerId: string) => {
    const next = !enabledProviders[providerId]
    setProviderEnabled(providerId, next)
    setEnabledProviders(prev => ({ ...prev, [providerId]: next }))
  }

  // Configured-rank order: env var > gateway > saved & enabled > saved & off > nothing.
  const configuredRank = (providerId: string) => {
    const state = getState(providerId)
    if (!state.enabled && state.hasLocalKey) return 3
    if (state.hasEnvKey) return 0
    if (state.aiGatewayCapable) return 1
    if (state.hasLocalKey && state.enabled) return 2
    return 4
  }

  const visibleProviders = useMemo(
    () => (filter === 'all' ? PROVIDERS : PROVIDERS.filter(p => p.categories.includes(filter))),
    [filter],
  )

  // A provider shows up under EVERY category it powers.
  const grouped = useMemo(() => {
    const out: Record<ProviderCategory, typeof PROVIDERS> = { text: [], image: [], video: [], audio: [] }
    visibleProviders.forEach(p => p.categories.forEach(cat => out[cat].push(p)))
    CATEGORY_ORDER.forEach(cat => {
      out[cat].sort((a, b) => {
        const rd = configuredRank(a.id) - configuredRank(b.id)
        return rd !== 0 ? rd : a.name.localeCompare(b.name)
      })
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleProviders, getState])

  // KPI strip — counts of providers in each connection state.
  const counts = useMemo(() => {
    let live = 0
    let gateway = 0
    let local = 0
    let idle = 0
    PROVIDERS.forEach(p => {
      const s = getState(p.id)
      if (s.hasEnvKey) live++
      else if (s.aiGatewayCapable) gateway++
      else if (s.hasLocalKey && s.enabled) local++
      else idle++
    })
    return { live, gateway, local, idle, total: PROVIDERS.length }
  }, [getState])

  return (
    <AdminShell
      crumb={['admin', 'platform']}
      here="Models"
      eyebrow="superadmin · providers · api keys"
      heading={
        <>
          Connect <em className="italic">every model.</em>
        </>
      }
      lead="Enable a provider, paste a key, and that model becomes available to every user across text, image, video and audio surfaces. Vercel env vars take priority, then the AI Gateway, then your local key."
      headExtra={
        <>
          {(['all', ...CATEGORY_ORDER] as const).map(cat => (
            <AdminFilter key={cat} active={filter === cat} onClick={() => setFilter(cat)}>
              {cat === 'all' ? 'all' : CATEGORY_LABELS[cat]}
            </AdminFilter>
          ))}
        </>
      }
      actions={
        <>
          <AdminIconBtn title="Re-check env vars" onClick={() => refresh()}>
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
          <AdminBtn primary onClick={() => refresh()}>
            Re-check
          </AdminBtn>
        </>
      }
    >
      {/* Toast — terracotta tinted, replaces alert() */}
      {savedMessage && (
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 border border-accent/40 bg-accent/10 rounded-sharp font-mono text-[10.5px] tracking-[0.06em] uppercase text-accent">
          {savedMessage}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 border border-hairline rounded-card bg-surface mb-[18px]">
        <Stat label="Total providers" value={counts.total.toString()} />
        <Stat label="Env-var live" value={counts.live.toString()} accent />
        <Stat label="Via gateway" value={counts.gateway.toString()} />
        <Stat label="Local key" value={counts.local.toString()} />
        <Stat label="Idle" value={counts.idle.toString()} muted />
      </div>

      {/* Gateway banner */}
      {aiGatewayConnected && (
        <div className="mb-[18px] flex items-start gap-3 px-5 py-4 border border-accent/30 bg-accent/[0.06] rounded-card">
          <span
            aria-hidden
            className="w-7 h-7 rounded-full bg-accent text-bg font-serif italic text-base flex items-center justify-center flex-shrink-0"
          >
            G
          </span>
          <div className="text-sm">
            <div className="font-medium">Vercel AI Gateway connected</div>
            <p className="text-ink-soft mt-0.5 leading-relaxed">
              OpenAI, Anthropic and Google models run zero-config through the gateway. Adding your own keys is optional and gives you higher rate limits.
            </p>
          </div>
        </div>
      )}

      {/* Per-category sections */}
      <div className="space-y-[18px]">
        {CATEGORY_ORDER.map(cat => {
          const list = grouped[cat]
          if (list.length === 0) return null
          return (
            <AdminPanel
              key={cat}
              title={CATEGORY_LABELS[cat]}
              meta={`${list.length} provider${list.length === 1 ? '' : 's'}`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-hairline border-t border-hairline">
                {list.map(provider => {
                  const state = getState(provider.id)
                  const { connected, source, hasEnvKey, aiGatewayCapable, hasLocalKey } = state
                  const modelsInCategory = getModelsForProviderInCategory(provider.id, cat)

                  const statusLabel =
                    source === 'env'
                      ? 'env var'
                      : source === 'gateway'
                        ? 'gateway'
                        : source === 'local'
                          ? enabledProviders[provider.id]
                            ? 'local key'
                            : 'paused'
                          : 'idle'

                  return (
                    <div
                      key={`${cat}-${provider.id}`}
                      className={`bg-surface p-5 ${connected ? '' : hasLocalKey ? '' : 'opacity-70 hover:opacity-100 transition-opacity'}`}
                    >
                      {/* Header: dot · status · serif name · toggle */}
                      <div className="flex items-start justify-between gap-3 mb-3.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              aria-hidden
                              className={`w-1.5 h-1.5 rounded-full ${
                                connected
                                  ? 'bg-accent'
                                  : hasLocalKey
                                    ? 'bg-ink-muted'
                                    : 'bg-ink-muted/40'
                              }`}
                            />
                            <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">
                              {statusLabel}
                            </span>
                          </div>
                          <h3 className="font-serif italic text-[20px] leading-tight tracking-[-0.01em]">
                            {provider.name}
                          </h3>
                          <div className="font-mono text-[10px] text-ink-muted tracking-[0.04em] mt-0.5 truncate">
                            {provider.envKey}
                          </div>
                        </div>
                        <Toggle
                          on={enabledProviders[provider.id]}
                          onClick={() => handleToggleEnabled(provider.id)}
                          label={`Toggle ${provider.name}`}
                        />
                      </div>

                      {/* Models powered */}
                      {modelsInCategory.length > 0 && (
                        <div className="mb-3.5">
                          <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted mb-1.5">
                            Powers {modelsInCategory.length} model{modelsInCategory.length === 1 ? '' : 's'}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {modelsInCategory.map(m => (
                              <span
                                key={m.id}
                                className={`font-mono text-[10px] tracking-[0.04em] px-2 py-0.5 border rounded-sharp ${
                                  connected
                                    ? 'border-accent/40 text-accent bg-accent/[0.06]'
                                    : 'border-hairline-soft text-ink-soft'
                                }`}
                              >
                                {m.displayName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Key field */}
                      <div className="border-t border-hairline-soft pt-3">
                        {editingProvider === provider.id ? (
                          <KeyEditor
                            initial={apiKeys[provider.id]}
                            onSave={v => handleSaveKey(provider.id, v)}
                            onCancel={() => setEditingProvider(null)}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="password"
                              value={
                                hasLocalKey
                                  ? '\u2022'.repeat(Math.min(apiKeys[provider.id].length, 32))
                                  : ''
                              }
                              readOnly
                              placeholder={
                                hasEnvKey
                                  ? 'Using Vercel env var'
                                  : aiGatewayCapable
                                    ? 'Using AI Gateway (optional override)'
                                    : 'No key configured'
                              }
                              className="flex-1 h-9 px-2.5 bg-bg border border-hairline-soft rounded-sharp font-mono text-[11.5px] text-ink placeholder:text-ink-muted outline-none"
                              aria-label={`${provider.name} api key`}
                            />
                            <AdminBtn onClick={() => setEditingProvider(provider.id)}>
                              {hasLocalKey ? 'Edit' : 'Add key'}
                            </AdminBtn>
                            {provider.docsUrl && (
                              <a
                                href={provider.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[10px] tracking-[0.06em] uppercase text-ink-soft hover:text-ink transition-colors"
                              >
                                docs ↗
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </AdminPanel>
          )
        })}
      </div>

      {/* Footer note */}
      <div className="mt-[18px] border border-hairline-soft rounded-card bg-surface px-6 py-5">
        <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted mb-2">
          how connected providers are chosen
        </div>
        <ul className="text-sm text-ink-soft space-y-1 list-disc pl-5 leading-relaxed">
          <li>
            <strong className="text-ink font-medium">Env var</strong> — a matching key is set on your Vercel project. Safest, highest priority.
          </li>
          <li>
            <strong className="text-ink font-medium">AI Gateway</strong> — OpenAI, Anthropic and Google work through the gateway with no key.
          </li>
          <li>
            <strong className="text-ink font-medium">Local key</strong> — a key you typed here, stored in your browser only.
          </li>
        </ul>
        <p className="text-[12px] text-ink-muted mt-3">
          Dropdowns across the Text / Image / Video / Audio workspaces only show models whose provider is connected and not toggled off.
        </p>
      </div>
    </AdminShell>
  )
}

// ---------------------------------------------------------------------------
// Local primitives
// ---------------------------------------------------------------------------

function Stat({ label, value, accent, muted }: { label: string; value: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="px-5 py-[18px] flex flex-col gap-0.5 border-r last:border-r-0 border-hairline-soft">
      <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">{label}</span>
      <span
        className={`font-serif text-[28px] leading-none tracking-[-0.02em] mt-1 ${
          accent ? 'italic text-accent' : muted ? 'text-ink-muted' : ''
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      className={`w-8 h-4 p-[1.5px] rounded-[9px] border inline-flex items-center transition-colors flex-shrink-0 ${
        on ? 'bg-ink border-ink justify-end' : 'bg-transparent border-hairline justify-start'
      }`}
    >
      <span className={`block w-[11px] h-[11px] rounded-full ${on ? 'bg-bg' : 'bg-ink-soft'}`} />
    </button>
  )
}

function KeyEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (v: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onSave(value)
          else if (e.key === 'Escape') onCancel()
        }}
        placeholder="Paste API key…"
        className="flex-1 h-9 px-2.5 bg-bg border border-ink rounded-sharp font-mono text-[11.5px] text-ink outline-none"
      />
      <AdminBtn primary onClick={() => onSave(value)}>
        Save
      </AdminBtn>
      <AdminBtn onClick={onCancel}>Cancel</AdminBtn>
    </div>
  )
}
