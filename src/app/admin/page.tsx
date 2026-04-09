'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PROVIDER_CATEGORIES = {
  'Text AI': ['openai', 'anthropic', 'google', 'meta', 'mistral', 'xai', 'cohere', 'ai21', 'deepseek', 'qwen', 'zhipu', 'kimi', 'baidu'],
  'Image AI': ['stability', 'midjourney', 'openai-dalle', 'google-imagen', 'ideogram', 'recraft', 'playground', 'zhipu', 'alibaba', 'baidu', 'kuaishou'],
  'Video AI': ['openai-sora', 'runway', 'luma', 'pika', 'haiper', 'stability', 'kuaishou', 'zhipu', 'pixverse', 'shengshu'],
  'Audio AI': ['elevenlabs', 'openai-tts', 'google-tts', 'microsoft', 'playht', 'suno', 'udio', 'stability', 'fishaudio', 'zhipu'],
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI (GPT)',
  'openai-dalle': 'OpenAI (DALL-E)',
  'openai-sora': 'OpenAI (Sora)',
  'openai-tts': 'OpenAI (TTS)',
  anthropic: 'Anthropic Claude',
  google: 'Google Gemini',
  'google-imagen': 'Google Imagen',
  'google-tts': 'Google Cloud TTS',
  meta: 'Meta Llama',
  mistral: 'Mistral AI',
  xai: 'xAI Grok',
  cohere: 'Cohere',
  ai21: 'AI21 Labs',
  deepseek: 'DeepSeek',
  qwen: 'Qwen (Alibaba)',
  zhipu: 'Zhipu AI',
  kimi: 'Kimi (Moonshot)',
  baidu: 'Baidu ERNIE',
  elevenlabs: 'ElevenLabs',
  playht: 'Play.ht',
  microsoft: 'Microsoft Azure',
  suno: 'Suno AI',
  udio: 'Udio AI',
  stability: 'Stability AI',
  midjourney: 'Midjourney',
  runway: 'Runway ML',
  luma: 'Luma AI',
  pika: 'Pika Labs',
  haiper: 'Haiper AI',
  kuaishou: 'Kuaishou (Kling)',
  ideogram: 'Ideogram',
  recraft: 'Recraft AI',
  playground: 'Playground AI',
  alibaba: 'Alibaba Cloud',
  pixverse: 'PixVerse',
  shengshu: 'Shengshu (Vidu)',
  fishaudio: 'Fish Audio',
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<string>('Text AI')
  const [apiKeys, setApiKeys] = useState<Record<string, { key: string; secret: string; url: string; enabled: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAuthAndLoadKeys = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      router.push('/auth/login')
      return
    }

    // Load from localStorage for now (can be migrated to Supabase table later)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clox_api_keys')
      if (saved) {
        try {
          setApiKeys(JSON.parse(saved))
        } catch (e) {
          console.error('Error parsing saved keys:', e)
        }
      }
    }
    
    setLoading(false)
  }

  const handleSave = (provider: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('clox_api_keys', JSON.stringify(apiKeys))
    }
    alert(`${PROVIDER_NAMES[provider] || provider} configuration saved successfully!`)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const updateField = (provider: string, field: 'key' | 'secret' | 'url' | 'enabled', value: string | boolean) => {
    setApiKeys(prev => ({
      ...prev,
      [provider]: {
        ...(prev[provider] || { key: '', secret: '', url: '', enabled: false }),
        [field]: value
      }
    }))
  }

  const providersInTab = PROVIDER_CATEGORIES[activeTab as keyof typeof PROVIDER_CATEGORIES] || []

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-secondary flex items-center justify-center">
        <div className="text-label-secondary">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-secondary dark:bg-surface">
      {/* Header */}
      <div className="bg-white dark:bg-surface border-b border-separator/50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">
              Clox Studio Admin
            </h1>
            <p className="text-sm mt-1 text-label-tertiary">Manage AI Provider API Keys</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 bg-surface-secondary dark:bg-surface-tertiary border border-separator rounded-hig-xl text-sm font-semibold text-label-secondary hover:text-label-primary hover:scale-105 active:scale-95 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-surface border-b border-separator/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6 overflow-x-auto">
            {Object.keys(PROVIDER_CATEGORIES).map(category => (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className={`px-4 py-4 text-sm font-bold transition-all whitespace-nowrap border-b-[3px] ${
                  activeTab === category 
                    ? 'border-brown text-brown' 
                    : 'border-transparent text-label-secondary hover:text-label-primary'
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
            const values = apiKeys[provider] || { key: '', secret: '', url: '', enabled: false }
            
            return (
              <div key={provider} className="bg-white dark:bg-surface rounded-hig-3xl p-6 space-y-5 shadow-float border border-separator/50">
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
                      className="w-5 h-5 rounded cursor-pointer accent-brown"
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
                    className="w-full h-12 px-4 bg-white dark:bg-surface-tertiary border-2 border-separator rounded-hig-xl text-sm font-mono text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/20 focus:border-brown transition-all"
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
                    className="w-full h-12 px-4 bg-white dark:bg-surface-tertiary border-2 border-separator rounded-hig-xl text-sm font-mono text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/20 focus:border-brown transition-all"
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
                    className="w-full h-12 px-4 bg-white dark:bg-surface-tertiary border-2 border-separator rounded-hig-xl text-sm font-mono text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/20 focus:border-brown transition-all"
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={() => handleSave(provider)}
                  className="w-full h-12 gradient-brown-teal text-white rounded-hig-xl font-bold shadow-float hover:shadow-hig-hover hover:scale-105 active:scale-95 transition-all"
                >
                  Save Configuration
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
