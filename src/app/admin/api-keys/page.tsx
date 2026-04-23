'use client'

import { motion } from 'framer-motion'
import { stagger, cardVariant } from '@/shared/ui/layout/AppLayout'
import { useState, useEffect } from 'react'
import { getAdminSettings, setProviderApiKey, setProviderEnabled } from '@/lib/admin-settings'
import { PROVIDERS, ProviderCategory } from '@/lib/providers'

const CATEGORY_LABELS: Record<ProviderCategory, string> = {
  text: 'Text & Chat',
  image: 'Image Generation',
  video: 'Video Generation',
  audio: 'Audio & Voice',
}

const CATEGORY_ORDER: ProviderCategory[] = ['text', 'image', 'video', 'audio']

export default function ApiKeysPage() {
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

  // Apply the category filter
  const visibleProviders = filter === 'all'
    ? PROVIDERS
    : PROVIDERS.filter(p => p.categories.includes(filter))

  // Group the visible providers by their primary category for display.
  // Within each category we sort so that *connected* providers (enabled AND
  // have an API key) appear at the top, then configured-but-disabled, then
  // unconfigured. Within each band we alphabetise by name for stability.
  const configuredRank = (providerId: string): number => {
    const hasKey = Boolean(apiKeys[providerId]?.trim())
    const enabled = enabledProviders[providerId] ?? true
    if (hasKey && enabled) return 0
    if (hasKey && !enabled) return 1
    return 2
  }

  const grouped: Record<ProviderCategory, typeof PROVIDERS> = { text: [], image: [], video: [], audio: [] }
  visibleProviders.forEach(p => {
    const primary = CATEGORY_ORDER.find(c => p.categories.includes(c)) || 'text'
    grouped[primary].push(p)
  })
  CATEGORY_ORDER.forEach(cat => {
    grouped[cat].sort((a, b) => {
      const rankDiff = configuredRank(a.id) - configuredRank(b.id)
      if (rankDiff !== 0) return rankDiff
      return a.name.localeCompare(b.name)
    })
  })

  return (
    <div className="p-10 bg-surface-secondary min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-end gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI API Configuration</h1>
            <p className="text-label-secondary mt-1">Enable providers and set API keys. Only enabled providers with keys appear in user dropdowns.</p>
          </div>
          {savedMessage && (
            <div className="px-4 py-2 bg-apple-teal/10 text-apple-teal rounded-lg text-sm font-medium">
              {savedMessage}
            </div>
          )}
        </header>

        {/* Category filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', ...CATEGORY_ORDER] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`h-9 px-4 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${
                filter === cat
                  ? 'bg-apple-teal text-white'
                  : 'bg-surface border border-separator text-label-secondary hover:bg-fill'
              }`}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {CATEGORY_ORDER.map(cat => {
          const list = grouped[cat]
          if (list.length === 0) return null
          return (
            <section key={cat} className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-label-secondary">{CATEGORY_LABELS[cat]}</h2>
              <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {list.map(provider => {
                  const configured = Boolean(apiKeys[provider.id])
                  const isLive = configured && (enabledProviders[provider.id] ?? true)
                  // Visually de-emphasise providers the user hasn't set up yet so
                  // connected ones read as the primary affordance.
                  const cardTone = isLive
                    ? 'bg-surface border-mint/40 ring-1 ring-mint/20'
                    : configured
                      ? 'bg-surface border-separator'
                      : 'bg-surface/60 border-separator/60 opacity-60 hover:opacity-100 transition-opacity'
                  const statusTone = isLive
                    ? 'text-mint'
                    : configured
                      ? 'text-label-secondary'
                      : 'text-label-tertiary'
                  return (
                    <motion.div key={provider.id} variants={cardVariant} className={`${cardTone} border rounded-2xl shadow-sm overflow-hidden`}>
                      <div className="p-5 border-b border-separator flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 ${
                            isLive ? 'bg-mint' : configured ? 'bg-apple-teal' : 'bg-fill'
                          }`}>
                            {provider.name[0]}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold truncate">{provider.name}</h3>
                            <div className={`text-[10px] uppercase font-bold tracking-widest ${statusTone}`}>
                              {isLive ? 'Connected' : configured ? 'Configured (off)' : 'Not configured'}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleEnabled(provider.id)}
                          className={`w-12 h-6 rounded-full p-1 transition-colors flex-shrink-0 ${enabledProviders[provider.id] ? 'bg-apple-teal' : 'bg-separator'}`}
                          aria-label={`Toggle ${provider.name}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${enabledProviders[provider.id] ? 'translate-x-6' : ''}`} />
                        </button>
                      </div>
                      <div className="p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight truncate">
                            {provider.envKey}
                          </label>
                          {provider.docsUrl && (
                            <a
                              href={provider.docsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-apple-teal hover:underline"
                            >
                              Get key ↗
                            </a>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {editingProvider === provider.id ? (
                            <>
                              <input
                                type="text"
                                placeholder="Enter API key…"
                                defaultValue={apiKeys[provider.id]}
                                className="flex-grow h-10 px-3 bg-fill/30 border border-separator rounded-lg text-sm focus:ring-2 focus:ring-apple-teal/20 focus:border-apple-teal outline-none"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveKey(provider.id, (e.target as HTMLInputElement).value)
                                  else if (e.key === 'Escape') setEditingProvider(null)
                                }}
                                autoFocus
                              />
                              <button
                                onClick={(e) => {
                                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                                  handleSaveKey(provider.id, input.value)
                                }}
                                className="px-4 bg-apple-teal text-white rounded-lg text-sm font-medium"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingProvider(null)}
                                className="px-4 bg-surface border border-separator rounded-lg text-sm font-medium"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <input
                                type="password"
                                value={apiKeys[provider.id] ? '•'.repeat(Math.min(apiKeys[provider.id].length, 32)) : ''}
                                readOnly
                                placeholder="No key configured"
                                className="flex-grow h-10 px-3 bg-fill/30 border border-separator rounded-lg text-sm"
                              />
                              <button
                                onClick={() => setEditingProvider(provider.id)}
                                className="px-4 bg-surface border border-separator rounded-lg text-sm font-medium hover:bg-fill/30 transition-colors"
                              >
                                {apiKeys[provider.id] ? 'Edit' : 'Add key'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </motion.div>
            </section>
          )
        })}

        <div className="bg-apple-teal/5 border border-apple-teal/20 rounded-xl p-6">
          <h3 className="font-bold mb-2">How the filter works</h3>
          <p className="text-sm text-label-secondary">
            User-facing dropdowns in the text, image, video and audio workspaces only show models whose provider is
            both toggled on and has an API key saved above. Everything else stays hidden until it&apos;s configured.
          </p>
        </div>
      </div>
    </div>
  )
}
