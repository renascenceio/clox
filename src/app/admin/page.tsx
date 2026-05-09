'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getAdminSettings, saveAdminSettings } from '@/lib/admin-settings'

// COMPLETE Provider configurations with documentation links
const PROVIDER_CONFIG = {
  // === TEXT AI (15 providers) ===
  openai: { name: 'OpenAI (ChatGPT)', category: 'Text AI', docs: 'https://platform.openai.com/docs', guide: 'Get API key from platform.openai.com/api-keys', fields: { key: true, secret: false, url: false } },
  anthropic: { name: 'Anthropic Claude', category: 'Text AI', docs: 'https://docs.anthropic.com/claude', guide: 'Get API key from console.anthropic.com', fields: { key: true, secret: false, url: false } },
  google: { name: 'Google Gemini', category: 'Text AI', docs: 'https://ai.google.dev/docs', guide: 'Get API key from makersuite.google.com/app/apikey', fields: { key: true, secret: false, url: false } },
  meta: { name: 'Meta Llama', category: 'Text AI', docs: 'https://llama.meta.com', guide: 'Access via Replicate or Together AI', fields: { key: true, secret: false, url: false } },
  mistral: { name: 'Mistral AI', category: 'Text AI', docs: 'https://docs.mistral.ai', guide: 'Get API key from console.mistral.ai', fields: { key: true, secret: false, url: false } },
  xai: { name: 'xAI Grok', category: 'Text AI', docs: 'https://docs.x.ai', guide: 'Get API key from x.ai/api', fields: { key: true, secret: false, url: false } },
  cohere: { name: 'Cohere', category: 'Text AI', docs: 'https://docs.cohere.com', guide: 'Get API key from dashboard.cohere.com', fields: { key: true, secret: false, url: false } },
  ai21: { name: 'AI21 Labs', category: 'Text AI', docs: 'https://docs.ai21.com', guide: 'Get API key from studio.ai21.com', fields: { key: true, secret: false, url: false } },
  deepseek: { name: 'DeepSeek', category: 'Text AI', docs: 'https://platform.deepseek.com/docs', guide: 'Get API key from platform.deepseek.com', fields: { key: true, secret: false, url: false } },
  qwen: { name: 'Qwen (Alibaba)', category: 'Text AI', docs: 'https://help.aliyun.com/zh/dashscope', guide: 'Get API key from dashscope.aliyuncs.com', fields: { key: true, secret: false, url: false } },
  zhipu: { name: 'GLM (Zhipu AI)', category: 'Text AI', docs: 'https://open.bigmodel.cn/dev/api', guide: 'Get API key from open.bigmodel.cn', fields: { key: true, secret: false, url: false } },
  kimi: { name: 'Kimi (Moonshot)', category: 'Text AI', docs: 'https://platform.moonshot.cn/docs', guide: 'Get API key from platform.moonshot.cn/console', fields: { key: true, secret: false, url: false } },
  baidu: { name: 'Baidu ERNIE', category: 'Text AI', docs: 'https://cloud.baidu.com/doc/WENXINWORKSHOP', guide: 'Get API key from console.bce.baidu.com', fields: { key: true, secret: false, url: false } },
  perplexity: { name: 'Perplexity', category: 'Text AI', docs: 'https://docs.perplexity.ai', guide: 'Get API key from perplexity.ai/settings/api', fields: { key: true, secret: false, url: false } },
  together: { name: 'Together AI', category: 'Text AI', docs: 'https://docs.together.ai', guide: 'Get API key from api.together.xyz/settings/api-keys', fields: { key: true, secret: false, url: false } },

  // === IMAGE AI (12 providers) ===
  'openai-dalle': { name: 'DALL-E 3', category: 'Image AI', docs: 'https://platform.openai.com/docs/guides/images', guide: 'Uses same API key as OpenAI GPT', fields: { key: true, secret: false, url: false } },
  midjourney: { name: 'Midjourney', category: 'Image AI', docs: 'https://docs.midjourney.com', guide: 'Use via Discord bot or unofficial API', fields: { key: true, secret: false, url: false } },
  stability: { name: 'Stability AI (SDXL)', category: 'Image AI', docs: 'https://platform.stability.ai/docs', guide: 'Get API key from platform.stability.ai/account/keys', fields: { key: true, secret: false, url: false } },
  replicate: { name: 'Replicate', category: 'Image AI', docs: 'https://replicate.com/docs', guide: 'Get API key from replicate.com/account/api-tokens', fields: { key: true, secret: false, url: false } },
  ideogram: { name: 'Ideogram', category: 'Image AI', docs: 'https://ideogram.ai/api-docs', guide: 'Get API key from ideogram.ai/api', fields: { key: true, secret: false, url: false } },
  flux: { name: 'Flux (Black Forest Labs)', category: 'Image AI', docs: 'https://docs.bfl.ml', guide: 'Access via Replicate or fal.ai', fields: { key: true, secret: false, url: false } },
  leonardo: { name: 'Leonardo.AI', category: 'Image AI', docs: 'https://docs.leonardo.ai', guide: 'Get API key from app.leonardo.ai', fields: { key: true, secret: false, url: false } },
  'scenario': { name: 'Scenario', category: 'Image AI', docs: 'https://docs.scenario.com', guide: 'Get API key from scenario.com', fields: { key: true, secret: false, url: false } },
  'adobe-firefly': { name: 'Adobe Firefly', category: 'Image AI', docs: 'https://developer.adobe.com/firefly-services/docs', guide: 'Get credentials from developer.adobe.com', fields: { key: true, secret: true, url: false } },
  getimg: { name: 'Getimg.ai', category: 'Image AI', docs: 'https://docs.getimg.ai', guide: 'Get API key from getimg.ai/dashboard/api-keys', fields: { key: true, secret: false, url: false } },
  segmind: { name: 'Segmind', category: 'Image AI', docs: 'https://docs.segmind.com', guide: 'Get API key from segmind.com/api-keys', fields: { key: true, secret: false, url: false } },
  'deepai': { name: 'DeepAI', category: 'Image AI', docs: 'https://deepai.org/apis', guide: 'Get API key from deepai.org/dashboard/profile', fields: { key: true, secret: false, url: false } },

  // === VIDEO AI (8 providers) ===
  'openai-sora': { name: 'OpenAI Sora', category: 'Video AI', docs: 'https://openai.com/sora', guide: 'Currently limited access - uses OpenAI API key', fields: { key: true, secret: false, url: false } },
  runway: { name: 'Runway Gen-3', category: 'Video AI', docs: 'https://docs.runwayml.com', guide: 'Get API key from app.runwayml.com/account', fields: { key: true, secret: true, url: false } },
  pika: { name: 'Pika', category: 'Video AI', docs: 'https://pika.art/api', guide: 'Request API access from pika.art', fields: { key: true, secret: false, url: false } },
  'luma-ai': { name: 'Luma AI (Dream Machine)', category: 'Video AI', docs: 'https://lumalabs.ai/api', guide: 'Get API key from lumalabs.ai', fields: { key: true, secret: false, url: false } },
  kling: { name: 'Kling AI', category: 'Video AI', docs: 'https://kling.kuaishou.com/en', guide: 'Chinese video AI - access via web interface', fields: { key: true, secret: false, url: false } },
  'hailuo-ai': { name: 'Hailuo MiniMax', category: 'Video AI', docs: 'https://www.hailuo.ai', guide: 'Chinese video AI from MiniMax', fields: { key: true, secret: false, url: false } },
  synthesia: { name: 'Synthesia', category: 'Video AI', docs: 'https://docs.synthesia.io', guide: 'Enterprise API - contact sales', fields: { key: true, secret: false, url: false } },
  heygen: { name: 'HeyGen', category: 'Video AI', docs: 'https://docs.heygen.com', guide: 'Get API key from app.heygen.com', fields: { key: true, secret: false, url: false } },

  // === AUDIO AI (10 providers) ===
  elevenlabs: { name: 'ElevenLabs (Voice)', category: 'Audio AI', docs: 'https://elevenlabs.io/docs', guide: 'Get API key from elevenlabs.io/subscription', fields: { key: true, secret: false, url: false } },
  'openai-tts': { name: 'OpenAI TTS', category: 'Audio AI', docs: 'https://platform.openai.com/docs/guides/text-to-speech', guide: 'Uses same API key as OpenAI GPT', fields: { key: true, secret: false, url: false } },
  'openai-whisper': { name: 'OpenAI Whisper (STT)', category: 'Audio AI', docs: 'https://platform.openai.com/docs/guides/speech-to-text', guide: 'Uses same API key as OpenAI GPT', fields: { key: true, secret: false, url: false } },
  resemble: { name: 'Resemble AI', category: 'Audio AI', docs: 'https://docs.resemble.ai', guide: 'Get API key from app.resemble.ai', fields: { key: true, secret: false, url: false } },
  playht: { name: 'Play.ht', category: 'Audio AI', docs: 'https://docs.play.ht', guide: 'Get API key from play.ht/app/api-access', fields: { key: true, secret: true, url: false } },
  murf: { name: 'Murf AI', category: 'Audio AI', docs: 'https://murf.ai/api', guide: 'Enterprise API - contact sales', fields: { key: true, secret: false, url: false } },
  'google-tts': { name: 'Google Cloud TTS', category: 'Audio AI', docs: 'https://cloud.google.com/text-to-speech/docs', guide: 'Get credentials from console.cloud.google.com', fields: { key: true, secret: true, url: false } },
  'azure-speech': { name: 'Azure Speech Services', category: 'Audio AI', docs: 'https://docs.microsoft.com/azure/cognitive-services/speech-service', guide: 'Get key from portal.azure.com', fields: { key: true, secret: false, url: false } },
  suno: { name: 'Suno (Music)', category: 'Audio AI', docs: 'https://suno.com', guide: 'Currently web-only, API coming soon', fields: { key: true, secret: false, url: false } },
  udio: { name: 'Udio (Music)', category: 'Audio AI', docs: 'https://udio.com', guide: 'Currently web-only, API coming soon', fields: { key: true, secret: false, url: false } },
}

type TabType = 'API Keys' | 'Users' | 'Translations' | 'Settings' | 'Analytics'

const TABS: TabType[] = ['API Keys', 'Users', 'Translations', 'Settings', 'Analytics']
const CATEGORIES = ['Text AI', 'Image AI', 'Video AI', 'Audio AI']

const LANG_INFO: Record<string, { name: string; code: string }> = {
  en: { name: 'English', code: 'EN' },
  es: { name: 'Spanish', code: 'ES' },
  fr: { name: 'French', code: 'FR' },
  de: { name: 'German', code: 'DE' },
  ja: { name: 'Japanese', code: 'JA' },
  zh: { name: 'Chinese', code: 'ZH' },
  ko: { name: 'Korean', code: 'KO' },
  ru: { name: 'Russian', code: 'RU' },
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('API Keys')
  const [activeCategory, setActiveCategory] = useState<string>('Text AI')
  const [apiKeys, setApiKeys] = useState<Record<string, { key: string; secret: string; url: string; enabled: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<Array<{ id: string; email?: string; created_at: string; email_confirmed_at?: string }>>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuthAndLoadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
      return
    }

    const settings = getAdminSettings()
    const keys: Record<string, { key: string; secret: string; url: string; enabled: boolean }> = {}
    Object.entries(settings.providers).forEach(([provider, config]) => {
      keys[provider] = {
        key: config.apiKey || '',
        secret: config.apiSecret || '',
        url: config.baseUrl || '',
        enabled: config.enabled,
      }
    })
    setApiKeys(keys)

    try {
      const { data: usersData } = await supabase.auth.admin.listUsers()
      if (usersData?.users) {
        setUsers(usersData.users as Array<{ id: string; email?: string; created_at: string; email_confirmed_at?: string }>)
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }

    setLoading(false)
  }

  const handleSaveKey = (provider: string) => {
    const config = apiKeys[provider]
    const settings = getAdminSettings()
    settings.providers[provider] = {
      enabled: config?.enabled ?? false,
      apiKey: config?.key || '',
      apiSecret: config?.secret || '',
      baseUrl: config?.url || '',
    }
    saveAdminSettings(settings)
    alert(`${PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG].name} settings saved`)
  }

  const handleToggleProvider = (provider: string) => {
    setApiKeys(prev => {
      const updated = {
        ...prev,
        [provider]: {
          ...prev[provider],
          key: prev[provider]?.key || '',
          secret: prev[provider]?.secret || '',
          url: prev[provider]?.url || '',
          enabled: !prev[provider]?.enabled,
        },
      }
      const settings = getAdminSettings()
      Object.entries(updated).forEach(([p, config]) => {
        settings.providers[p] = {
          enabled: config.enabled,
          apiKey: config.key || '',
          apiSecret: config.secret || '',
          baseUrl: config.url || '',
        }
      })
      saveAdminSettings(settings)
      return updated
    })
  }

  const providersInCategory = Object.entries(PROVIDER_CONFIG).filter(
    ([, config]) => config.category === activeCategory,
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-muted">
          loading…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-ink font-sans">
      {/* ================================================================== */}
      {/* Top strip — editorial header with breadcrumb + section title.       */}
      {/* ================================================================== */}
      <header className="sticky top-0 z-30 bg-bg/85 backdrop-blur border-b border-hairline">
        <div className="max-w-7xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-serif italic text-2xl text-accent leading-none">C</span>
            <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">
              admin / super
            </span>
            <span className="font-serif italic text-lg text-ink">{activeTab}</span>
          </div>
          <button
            onClick={() => router.push('/text')}
            className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink transition-colors"
          >
            return to studio →
          </button>
        </div>
      </header>

      {/* ================================================================== */}
      {/* Tab bar — hairline rule with active 2px accent.                      */}
      {/* ================================================================== */}
      <div className="border-b border-hairline">
        <div className="max-w-7xl mx-auto px-8 flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-3 font-mono text-[11px] tracking-[0.04em] uppercase transition-colors ${
                activeTab === tab ? 'text-ink' : 'text-ink-muted hover:text-ink-soft'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-ink" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ================================================================== */}
      {/* Content                                                              */}
      {/* ================================================================== */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        {activeTab === 'API Keys' && (
          <div className="space-y-8">
            <div>
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase mb-2">
                providers
              </div>
              <h2 className="font-serif italic text-3xl text-ink mb-1">
                Connect every model.
              </h2>
              <p className="text-sm text-ink-soft max-w-xl leading-relaxed">
                Enable a provider, paste a key, and that model becomes available to every
                user across text, image, video and audio surfaces.
              </p>
            </div>

            {/* Category bar — flat row of mono uppercase tabs with hairline divider. */}
            <div className="flex items-center gap-px bg-hairline border border-hairline">
              {CATEGORIES.map(cat => {
                const count = Object.values(PROVIDER_CONFIG).filter(p => p.category === cat).length
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-1 px-4 py-3 bg-surface font-mono text-[11px] tracking-[0.04em] uppercase transition-colors flex items-center justify-between ${
                      activeCategory === cat ? 'text-ink' : 'text-ink-muted hover:text-ink-soft hover:bg-surface-alt'
                    }`}
                  >
                    <span>{cat.replace(' AI', '')}</span>
                    <span className="text-ink-muted ml-3">{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Provider list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-hairline border border-hairline">
              {providersInCategory.map(([key, config]) => {
                const data = apiKeys[key] || { key: '', secret: '', url: '', enabled: false }
                return (
                  <div key={key} className="bg-surface p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${data.enabled ? 'bg-accent' : 'bg-ink-muted/40'}`}
                            aria-hidden
                          />
                          <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">
                            {data.enabled ? 'connected' : 'idle'}
                          </span>
                        </div>
                        <h3 className="font-serif italic text-xl text-ink leading-tight">
                          {config.name}
                        </h3>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={data.enabled}
                          onChange={() => handleToggleProvider(key)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-rail-soft border border-hairline relative transition-colors peer-checked:bg-ink peer-checked:border-ink after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-bg after:border after:border-hairline after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4 peer-checked:after:border-ink" />
                      </label>
                    </div>

                    <div className="space-y-3">
                      {config.fields.key && (
                        <div>
                          <label className="block font-mono text-[10px] tracking-[0.04em] uppercase text-ink-muted mb-1.5">
                            api key
                          </label>
                          <input
                            type="password"
                            value={data.key}
                            onChange={e => setApiKeys(prev => ({ ...prev, [key]: { ...prev[key], key: e.target.value } }))}
                            placeholder="sk-…"
                            className="w-full px-3 py-2 bg-bg border border-hairline rounded-card text-sm font-mono text-ink placeholder:text-ink-muted outline-none focus:border-ink/40 transition-colors"
                          />
                        </div>
                      )}

                      {config.fields.secret && (
                        <div>
                          <label className="block font-mono text-[10px] tracking-[0.04em] uppercase text-ink-muted mb-1.5">
                            api secret
                          </label>
                          <input
                            type="password"
                            value={data.secret}
                            onChange={e => setApiKeys(prev => ({ ...prev, [key]: { ...prev[key], secret: e.target.value } }))}
                            placeholder="secret…"
                            className="w-full px-3 py-2 bg-bg border border-hairline rounded-card text-sm font-mono text-ink placeholder:text-ink-muted outline-none focus:border-ink/40 transition-colors"
                          />
                        </div>
                      )}

                      <p className="text-[12px] text-ink-soft leading-relaxed">{config.guide}</p>

                      <div className="flex items-center gap-3 pt-2 border-t border-hairline-soft">
                        <button
                          onClick={() => handleSaveKey(key)}
                          className="px-3 py-1.5 bg-ink text-bg font-mono text-[10px] tracking-[0.04em] uppercase hover:bg-ink-soft transition-colors"
                        >
                          save
                        </button>
                        <a
                          href={config.docs}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink transition-colors"
                        >
                          docs ↗
                        </a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'Users' && (
          <div className="space-y-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase mb-2">
                users
              </div>
              <h2 className="font-serif italic text-3xl text-ink mb-1">
                Who is in the studio.
              </h2>
            </div>

            <div className="border border-hairline">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="text-left px-5 py-3 font-mono text-[10px] tracking-[0.04em] uppercase text-ink-muted">email</th>
                    <th className="text-left px-5 py-3 font-mono text-[10px] tracking-[0.04em] uppercase text-ink-muted">status</th>
                    <th className="text-left px-5 py-3 font-mono text-[10px] tracking-[0.04em] uppercase text-ink-muted">created</th>
                    <th className="text-left px-5 py-3 font-mono text-[10px] tracking-[0.04em] uppercase text-ink-muted">actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-hairline-soft last:border-0">
                      <td className="px-5 py-4 text-sm text-ink">{u.email}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">
                          <span className={`w-1.5 h-1.5 rounded-full ${u.email_confirmed_at ? 'bg-accent' : 'bg-ink-muted/50'}`} />
                          {u.email_confirmed_at ? 'active' : 'pending'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-[12px] text-ink-soft">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <button className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink transition-colors">
                          manage
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 font-mono text-[11px] tracking-[0.04em] uppercase text-ink-muted text-center">
                        no users yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Translations' && (
          <div className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase mb-2">
                  translations
                </div>
                <h2 className="font-serif italic text-3xl text-ink mb-1">
                  Speak every language.
                </h2>
                <p className="text-sm text-ink-soft max-w-xl leading-relaxed">
                  Manage interface copy across the supported locales. The editor lives in
                  its own surface for focus.
                </p>
              </div>
              <button
                onClick={() => router.push('/admin/translations')}
                className="px-4 py-2 bg-ink text-bg font-mono text-[11px] tracking-[0.04em] uppercase hover:bg-ink-soft transition-colors"
              >
                open editor →
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-hairline border border-hairline">
              {Object.entries(LANG_INFO).map(([lang, info]) => (
                <div key={lang} className="bg-surface p-5">
                  <div className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-muted mb-2">
                    {info.code}
                  </div>
                  <div className="font-serif italic text-lg text-ink leading-tight mb-1">
                    {info.name}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.04em] uppercase text-ink-muted">
                    {lang === 'en' ? 'base locale' : 'manage in editor'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="space-y-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase mb-2">
                system
              </div>
              <h2 className="font-serif italic text-3xl text-ink mb-1">Global settings.</h2>
            </div>
            <div className="border border-hairline p-6 bg-surface">
              <p className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-muted">
                global configuration — coming soon
              </p>
            </div>
          </div>
        )}

        {activeTab === 'Analytics' && (
          <div className="space-y-6">
            <div>
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase mb-2">
                analytics
              </div>
              <h2 className="font-serif italic text-3xl text-ink mb-1">Usage at a glance.</h2>
            </div>
            <div className="border border-hairline p-6 bg-surface">
              <p className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-muted">
                api usage and metrics — coming soon
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
