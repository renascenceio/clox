'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface APIKey {
  id: string
  provider: string
  api_key: string | null
  api_secret: string | null
  base_url: string | null
  enabled: boolean
}

const PROVIDER_CATEGORIES = {
  'Text AI': ['openai', 'anthropic', 'google', 'meta', 'mistral', 'xai', 'cohere', 'ai21', 'deepseek', 'qwen', 'zhipu', 'kimi', 'baidu'],
  'Image AI': ['stability', 'midjourney', 'openai', 'google', 'ideogram', 'recraft', 'playground', 'zhipu', 'alibaba', 'baidu', 'kuaishou'],
  'Video AI': ['openai', 'runway', 'luma', 'pika', 'haiper', 'stability', 'kuaishou', 'zhipu', 'pixverse', 'shengshu'],
  'Audio AI': ['elevenlabs', 'openai', 'google', 'microsoft', 'playht', 'suno', 'udio', 'stability', 'fishaudio', 'zhipu'],
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  meta: 'Meta',
  mistral: 'Mistral AI',
  xai: 'xAI',
  cohere: 'Cohere',
  ai21: 'AI21 Labs',
  deepseek: 'DeepSeek',
  qwen: 'Qwen (Alibaba)',
  zhipu: 'Zhipu AI',
  kimi: 'Kimi (Moonshot)',
  baidu: 'Baidu',
  elevenlabs: 'ElevenLabs',
  playht: 'Play.ht',
  microsoft: 'Microsoft Azure',
  suno: 'Suno',
  udio: 'Udio',
  stability: 'Stability AI',
  midjourney: 'Midjourney',
  runway: 'Runway',
  luma: 'Luma AI',
  pika: 'Pika',
  haiper: 'Haiper',
  kuaishou: 'Kuaishou',
  ideogram: 'Ideogram',
  recraft: 'Recraft',
  playground: 'Playground',
  alibaba: 'Alibaba',
  pixverse: 'PixVerse',
  shengshu: 'Shengshu',
  fishaudio: 'FishAudio',
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<string>('Text AI')
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingKey, setEditingKey] = useState<Record<string, { key: string; secret: string; url: string; enabled: boolean }>>({})
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadAPIKeys()
  }, [])

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/auth/login')
    }
  }

  const loadAPIKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('provider')

      if (error) throw error
      
      setApiKeys(data || [])
      
      // Initialize editing state
      const initial: Record<string, { key: string; secret: string; url: string; enabled: boolean }> = {}
      data?.forEach(key => {
        initial[key.provider] = {
          key: key.api_key || '',
          secret: key.api_secret || '',
          url: key.base_url || '',
          enabled: key.enabled
        }
      })
      setEditingKey(initial)
    } catch (error) {
      console.error('Error loading API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (provider: string) => {
    setSaving(true)
    try {
      const values = editingKey[provider]
      const { error } = await supabase
        .from('api_keys')
        .upsert({
          provider,
          api_key: values.key || null,
          api_secret: values.secret || null,
          base_url: values.url || null,
          enabled: values.enabled,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'provider'
        })

      if (error) throw error
      
      await loadAPIKeys()
      alert(`${PROVIDER_NAMES[provider]} configuration saved successfully!`)
    } catch (error) {
      console.error('Error saving:', error)
      alert('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const updateField = (provider: string, field: 'key' | 'secret' | 'url' | 'enabled', value: string | boolean) => {
    setEditingKey(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brown border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-label-tertiary">Loading...</p>
        </div>
      </div>
    )
  }

  const providersInTab = PROVIDER_CATEGORIES[activeTab as keyof typeof PROVIDER_CATEGORIES] || []

  return (
    <div className="min-h-screen bg-surface-secondary">
      {/* Header */}
      <div className="bg-surface border-b border-separator/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Clox Studio Admin</h1>
            <p className="text-sm text-label-tertiary mt-1">Manage AI Provider API Keys</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-surface-secondary border border-separator/50 rounded-hig-lg text-sm font-semibold text-label-secondary hover:bg-fill transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-surface border-b border-separator/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-4 overflow-x-auto">
            {Object.keys(PROVIDER_CATEGORIES).map(category => (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className={`px-6 py-4 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                  activeTab === category
                    ? 'border-brown text-brown'
                    : 'border-transparent text-label-secondary hover:text-label-primary hover:border-separator'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {providersInTab.map(provider => {
            const values = editingKey[provider] || { key: '', secret: '', url: '', enabled: false }
            
            return (
              <div key={provider} className="glass-float rounded-hig-2xl p-6 space-y-4 shadow-sm">
                {/* Provider Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-label-primary">
                    {PROVIDER_NAMES[provider] || provider}
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={values.enabled}
                      onChange={(e) => updateField(provider, 'enabled', e.target.checked)}
                      className="w-5 h-5 rounded accent-brown cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-label-secondary">Enabled</span>
                  </label>
                </div>

                {/* API Key Field */}
                <div>
                  <label className="block text-xs font-bold text-label-secondary uppercase tracking-widest mb-2">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={values.key}
                    onChange={(e) => updateField(provider, 'key', e.target.value)}
                    placeholder="sk-..."
                    className="w-full h-11 px-4 bg-surface border-2 border-separator/50 rounded-hig-lg text-sm font-mono focus:ring-2 focus:ring-brown/20 focus:border-brown outline-none transition-all"
                  />
                </div>

                {/* API Secret Field (optional) */}
                <div>
                  <label className="block text-xs font-bold text-label-secondary uppercase tracking-widest mb-2">
                    API Secret (Optional)
                  </label>
                  <input
                    type="password"
                    value={values.secret}
                    onChange={(e) => updateField(provider, 'secret', e.target.value)}
                    placeholder="Optional secret key"
                    className="w-full h-11 px-4 bg-surface border-2 border-separator/50 rounded-hig-lg text-sm font-mono focus:ring-2 focus:ring-brown/20 focus:border-brown outline-none transition-all"
                  />
                </div>

                {/* Base URL Field (optional) */}
                <div>
                  <label className="block text-xs font-bold text-label-secondary uppercase tracking-widest mb-2">
                    Base URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={values.url}
                    onChange={(e) => updateField(provider, 'url', e.target.value)}
                    placeholder="https://api.example.com"
                    className="w-full h-11 px-4 bg-surface border-2 border-separator/50 rounded-hig-lg text-sm font-mono focus:ring-2 focus:ring-brown/20 focus:border-brown outline-none transition-all"
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={() => handleSave(provider)}
                  disabled={saving}
                  className="w-full h-11 gradient-brown-teal text-white rounded-hig-xl font-bold shadow-float hover:shadow-hig-hover hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
