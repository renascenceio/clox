'use client'

/**
 * Models — what the Vercel AI Gateway gives Omma.
 *
 * Lives at /admin/api-keys but presents itself as "Models" in the
 * super-admin rail. Every model runs through the gateway, so there are no
 * per-provider keys to manage: this page shows the gateway connection,
 * every provider it serves (with model counts per surface), and a switch
 * per provider that hides its models from the pickers.
 */

import { useEffect, useMemo, useState } from 'react'
import { getAdminSettings, setProviderEnabled } from '@/lib/admin-settings'
import { useProviderStatus } from '@/lib/provider-status'
import {
  AUDIO_MODELS,
  IMAGE_MODELS,
  TEXT_MODELS,
  VIDEO_MODELS,
  gatewayProviders,
  type ModelEntry,
} from '@/lib/gateway/catalog'
import AdminShell, {
  AdminBtn,
  AdminFilter,
  AdminIconBtn,
  AdminPanel,
} from '@/shared/ui/admin/AdminShell'

type Category = 'text' | 'image' | 'video' | 'audio'

const CATEGORY_LABELS: Record<Category, string> = {
  text: 'Text & chat',
  image: 'Image',
  video: 'Video',
  audio: 'Audio & voice',
}
const CATEGORY_ORDER: Category[] = ['text', 'image', 'video', 'audio']
const MODELS: Record<Category, ModelEntry[]> = {
  text: TEXT_MODELS,
  image: IMAGE_MODELS,
  video: VIDEO_MODELS,
  audio: AUDIO_MODELS,
}

export default function ModelsAdminPage() {
  const { aiGatewayConnected, loading, refresh } = useProviderStatus()
  const providers = useMemo(() => gatewayProviders(), [])
  const [enabled, setEnabled] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const settings = getAdminSettings()
    const next: Record<string, boolean> = {}
    providers.forEach(p => { next[p.id] = settings.providers[p.id]?.enabled ?? true })
    setEnabled(next)
  }, [providers])

  const toggle = (id: string) => {
    const next = !enabled[id]
    setProviderEnabled(id, next)
    setEnabled(prev => ({ ...prev, [id]: next }))
  }

  const q = query.trim().toLowerCase()
  const visibleCategories = filter === 'all' ? CATEGORY_ORDER : [filter]

  const totals = useMemo(() => ({
    providers: providers.length,
    text: TEXT_MODELS.length,
    image: IMAGE_MODELS.length,
    video: VIDEO_MODELS.length,
    audio: AUDIO_MODELS.length,
  }), [providers])

  return (
    <AdminShell
      crumb={['admin', 'platform']}
      here="Models"
      eyebrow="superadmin · vercel ai gateway"
      heading={<>Every model, <em className="italic">one gateway.</em></>}
      lead="All text, image, video and audio generation runs through the Vercel AI Gateway — billing, rate limits and failover are handled there, and no provider keys are stored in Omma. Switch a provider off to hide its models from every picker."
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
          <AdminIconBtn title="Re-check gateway connection" onClick={() => refresh()}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path d="M11 6.5a4.5 4.5 0 1 1-1.32-3.18M11 1.5v3H8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </AdminIconBtn>
          <AdminBtn primary onClick={() => refresh()}>Re-check</AdminBtn>
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-5 border border-hairline rounded-card bg-surface mb-[18px]">
        <Stat label="Providers" value={totals.providers.toString()} accent />
        <Stat label="Text models" value={totals.text.toString()} />
        <Stat label="Image models" value={totals.image.toString()} />
        <Stat label="Video models" value={totals.video.toString()} />
        <Stat label="Audio models" value={totals.audio.toString()} />
      </div>

      <div
        className={`mb-[18px] flex items-start gap-3 px-5 py-4 border rounded-card ${
          aiGatewayConnected ? 'border-accent/30 bg-accent/[0.06]' : 'border-hairline bg-surface'
        }`}
        role="status"
      >
        <span
          aria-hidden
          className={`w-7 h-7 rounded-full font-serif italic text-base flex items-center justify-center flex-shrink-0 ${
            aiGatewayConnected ? 'bg-accent text-bg' : 'bg-hairline text-ink-soft'
          }`}
        >
          G
        </span>
        <div className="text-sm">
          <div className="font-medium">
            {loading ? 'Checking the AI Gateway…' : aiGatewayConnected ? 'Vercel AI Gateway connected' : 'Vercel AI Gateway not connected'}
          </div>
          <p className="text-ink-soft mt-0.5 leading-relaxed text-pretty">
            {aiGatewayConnected
              ? 'Deployed on Vercel, the app authenticates with its OIDC token automatically. Spend and usage show in your Vercel dashboard under AI Gateway.'
              : 'On Vercel this connects automatically. For local runs set AI_GATEWAY_API_KEY, or pull an OIDC token with `vercel env pull`.'}
          </p>
        </div>
      </div>

      <div className="mb-[18px]">
        <label htmlFor="model-search" className="sr-only">Search providers and models</label>
        <input
          id="model-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search providers or models…"
          className="w-full h-9 px-3 bg-surface border border-hairline rounded-sharp font-mono text-[11.5px] text-ink placeholder:text-ink-muted outline-none focus:border-ink"
        />
      </div>

      <div className="space-y-[18px]">
        {visibleCategories.map(cat => {
          const rows = providers
            .filter(p => p.counts[cat] > 0)
            .map(p => ({
              ...p,
              models: MODELS[cat].filter(m => m.provider === p.id),
            }))
            .map(p => ({
              ...p,
              models: q && !p.brand.toLowerCase().includes(q) && !p.id.includes(q)
                ? p.models.filter(m => `${m.name} ${m.id}`.toLowerCase().includes(q))
                : p.models,
            }))
            .filter(p => p.models.length > 0)
          if (rows.length === 0) return null
          return (
            <AdminPanel
              key={cat}
              title={CATEGORY_LABELS[cat]}
              meta={`${rows.length} provider${rows.length === 1 ? '' : 's'} · ${rows.reduce((n, r) => n + r.models.length, 0)} models`}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-hairline border-t border-hairline">
                {rows.map(p => {
                  const on = enabled[p.id] ?? true
                  const live = on && aiGatewayConnected
                  return (
                    <div key={`${cat}-${p.id}`} className={`bg-surface p-5 ${on ? '' : 'opacity-60 hover:opacity-100 transition-opacity'}`}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-accent' : 'bg-ink-muted/40'}`} />
                            <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">
                              {!on ? 'hidden' : aiGatewayConnected ? 'via gateway' : 'not connected'}
                            </span>
                          </div>
                          <h3 className="font-serif italic text-[20px] leading-tight tracking-[-0.01em]">{p.brand}</h3>
                          <div className="font-mono text-[10px] text-ink-muted tracking-[0.04em] mt-0.5 truncate">{`${p.id}/*`}</div>
                        </div>
                        <Toggle on={on} onClick={() => toggle(p.id)} label={`Show ${p.brand} models`} />
                      </div>
                      <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted mb-1.5">
                        {p.models.length} model{p.models.length === 1 ? '' : 's'}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.models.map(m => (
                          <span
                            key={m.id}
                            title={m.id}
                            className={`font-mono text-[10px] tracking-[0.04em] px-2 py-0.5 border rounded-sharp ${
                              live ? 'border-accent/40 text-accent bg-accent/[0.06]' : 'border-hairline-soft text-ink-soft'
                            }`}
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </AdminPanel>
          )
        })}
      </div>

      <div className="mt-[18px] border border-hairline-soft rounded-card bg-surface px-6 py-5">
        <div className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted mb-2">keeping the list current</div>
        <p className="text-sm text-ink-soft leading-relaxed text-pretty">
          The catalogue is generated from the gateway&apos;s model list. Run{' '}
          <code className="font-mono text-[11.5px] text-ink">node scripts/sync-gateway-models.mjs</code>{' '}
          to pick up newly released models; each model&apos;s settings (temperature, reasoning, sizes, durations, voices…) are derived from what the gateway reports for it.
        </p>
      </div>
    </AdminShell>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-5 py-[18px] flex flex-col gap-0.5 border-r last:border-r-0 border-hairline-soft">
      <span className="font-mono text-[9.5px] tracking-[0.18em] uppercase text-ink-muted">{label}</span>
      <span className={`font-serif text-[28px] leading-none tracking-[-0.02em] mt-1 ${accent ? 'italic text-accent' : ''}`}>{value}</span>
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
