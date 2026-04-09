'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

  useEffect(() => {
    // Check if user is logged in
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('clox_admin_session')
      if (!session) {
        router.push('/auth/login')
        return
      }
    }

    // Load saved API keys from localStorage
    const saved = localStorage.getItem('clox_api_keys')
    if (saved) {
      try {
        setApiKeys(JSON.parse(saved))
      } catch (e) {
        console.error('Error parsing saved keys:', e)
      }
    }
  }, [router])

  const handleSave = (provider: string) => {
    // Save to localStorage
    localStorage.setItem('clox_api_keys', JSON.stringify(apiKeys))
    alert(`${PROVIDER_NAMES[provider] || provider} configuration saved successfully!`)
  }

  const handleLogout = () => {
    localStorage.removeItem('clox_admin_session')
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

  return (
    <div className="min-h-screen" style={{ background: '#F2F2F7' }}>
      {/* Header */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(229, 229, 234, 0.5)' }}>
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #A2845E 0%, #5AC8C8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Clox Studio Admin
            </h1>
            <p className="text-sm mt-1" style={{ color: '#8E8E93' }}>Manage AI Provider API Keys</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 active:scale-95"
            style={{ background: '#F2F2F7', border: '1px solid rgba(229, 229, 234, 0.8)', color: '#636366' }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid rgba(229, 229, 234, 0.3)' }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6 overflow-x-auto">
            {Object.keys(PROVIDER_CATEGORIES).map(category => (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className="px-4 py-4 text-sm font-bold transition-all whitespace-nowrap"
                style={{
                  borderBottom: activeTab === category ? '3px solid #A2845E' : '3px solid transparent',
                  color: activeTab === category ? '#A2845E' : '#636366'
                }}
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
              <div key={provider} className="rounded-3xl p-6 space-y-5 shadow-lg" style={{ background: '#FFFFFF', border: '1px solid rgba(229, 229, 234, 0.5)' }}>
                {/* Provider Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold" style={{ color: '#1C1C1E' }}>
                    {PROVIDER_NAMES[provider] || provider}
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={values.enabled}
                      onChange={(e) => updateField(provider, 'enabled', e.target.checked)}
                      className="w-5 h-5 rounded cursor-pointer"
                      style={{ accentColor: '#A2845E' }}
                    />
                    <span className="text-xs font-semibold" style={{ color: '#636366' }}>Enabled</span>
                  </label>
                </div>

                {/* API Key Field */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#636366' }}>
                    API Key
                  </label>
                  <input
                    type="password"
                    value={values.key}
                    onChange={(e) => updateField(provider, 'key', e.target.value)}
                    placeholder="sk-..."
                    className="w-full h-12 px-4 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all"
                    style={{ background: '#FFFFFF', border: '2px solid rgba(229, 229, 234, 0.8)', color: '#1C1C1E' }}
                  />
                </div>

                {/* API Secret Field (optional) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#636366' }}>
                    API Secret (Optional)
                  </label>
                  <input
                    type="password"
                    value={values.secret}
                    onChange={(e) => updateField(provider, 'secret', e.target.value)}
                    placeholder="Optional secret key"
                    className="w-full h-12 px-4 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all"
                    style={{ background: '#FFFFFF', border: '2px solid rgba(229, 229, 234, 0.8)', color: '#1C1C1E' }}
                  />
                </div>

                {/* Base URL Field (optional) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#636366' }}>
                    Base URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={values.url}
                    onChange={(e) => updateField(provider, 'url', e.target.value)}
                    placeholder="https://api.example.com"
                    className="w-full h-12 px-4 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-opacity-20 transition-all"
                    style={{ background: '#FFFFFF', border: '2px solid rgba(229, 229, 234, 0.8)', color: '#1C1C1E' }}
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={() => handleSave(provider)}
                  className="w-full h-12 text-white rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
                  style={{ background: 'linear-gradient(135deg, #A2845E 0%, #5AC8C8 100%)', boxShadow: '0 8px 20px rgba(162, 132, 94, 0.3)' }}
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
