'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Provider configurations with documentation links
const PROVIDER_CONFIG = {
  // Text AI
  openai: {
    name: 'OpenAI (GPT)',
    category: 'Text AI',
    docs: 'https://platform.openai.com/docs/api-reference',
    guide: 'Get your API key from platform.openai.com/api-keys',
    fields: { key: true, secret: false, url: false }
  },
  anthropic: {
    name: 'Anthropic Claude',
    category: 'Text AI',
    docs: 'https://docs.anthropic.com/claude/reference',
    guide: 'Get your API key from console.anthropic.com',
    fields: { key: true, secret: false, url: false }
  },
  google: {
    name: 'Google Gemini',
    category: 'Text AI',
    docs: 'https://ai.google.dev/docs',
    guide: 'Get your API key from makersuite.google.com/app/apikey',
    fields: { key: true, secret: false, url: false }
  },
  // Add more providers...
  // Image AI
  'openai-dalle': {
    name: 'OpenAI DALL-E',
    category: 'Image AI',
    docs: 'https://platform.openai.com/docs/guides/images',
    guide: 'Uses same API key as OpenAI GPT',
    fields: { key: true, secret: false, url: false }
  },
  stability: {
    name: 'Stability AI',
    category: 'Image AI',
    docs: 'https://platform.stability.ai/docs',
    guide: 'Get your API key from platform.stability.ai/account/keys',
    fields: { key: true, secret: false, url: false }
  },
  // Video AI
  'openai-sora': {
    name: 'OpenAI Sora',
    category: 'Video AI',
    docs: 'https://platform.openai.com/docs/guides/video',
    guide: 'Uses same API key as OpenAI GPT (when available)',
    fields: { key: true, secret: false, url: false }
  },
  runway: {
    name: 'Runway ML',
    category: 'Video AI',
    docs: 'https://docs.runwayml.com',
    guide: 'Get your API key from app.runwayml.com/account',
    fields: { key: true, secret: true, url: false }
  },
  // Audio AI
  elevenlabs: {
    name: 'ElevenLabs',
    category: 'Audio AI',
    docs: 'https://elevenlabs.io/docs/api-reference',
    guide: 'Get your API key from elevenlabs.io/subscription',
    fields: { key: true, secret: false, url: false }
  },
  'openai-tts': {
    name: 'OpenAI TTS',
    category: 'Audio AI',
    docs: 'https://platform.openai.com/docs/guides/text-to-speech',
    guide: 'Uses same API key as OpenAI GPT',
    fields: { key: true, secret: false, url: false }
  },
}

type TabType = 'API Keys' | 'Users' | 'Settings' | 'Analytics'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('API Keys')
  const [activeCategory, setActiveCategory] = useState<string>('Text AI')
  const [apiKeys, setApiKeys] = useState<Record<string, { key: string; secret: string; url: string; enabled: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
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

    // Load API keys from localStorage
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

    // Load users from Supabase
    const { data: usersData } = await supabase.auth.admin.listUsers()
    if (usersData) {
      setUsers(usersData.users)
    }
    
    setLoading(false)
  }

  const handleSaveKey = (provider: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('clox_api_keys', JSON.stringify(apiKeys))
    }
    alert(`${PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG]?.name || provider} configuration saved successfully!`)
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

  const categories = ['Text AI', 'Image AI', 'Video AI', 'Audio AI']
  const providersInCategory = Object.entries(PROVIDER_CONFIG).filter(
    ([_, config]) => config.category === activeCategory
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-brown-50 to-teal-50 dark:from-[#1C1C1E] dark:via-[#2C2C2E] dark:to-[#1C1C1E] flex items-center justify-center">
        <div className="animate-blob w-12 h-12 gradient-brown-teal rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-white via-brown-50 to-teal-50 dark:from-[#1C1C1E] dark:via-[#2C2C2E] dark:to-[#1C1C1E]">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-brown/20 dark:bg-brown/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-teal/20 dark:bg-teal/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl animate-blob [animation-delay:2s]"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-brown-300/20 dark:bg-brown-300/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl animate-blob [animation-delay:4s]"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 bg-white/90 dark:bg-surface/90 backdrop-blur-xl border-b border-separator/50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 gradient-brown-teal rounded-hig-lg flex items-center justify-center shadow-brown-glow">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-label-primary">
                Clox Studio Admin
              </h1>
              <p className="text-sm text-label-tertiary">Comprehensive Dashboard</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-5 py-2.5 bg-surface-secondary dark:bg-surface-tertiary border border-separator rounded-hig-xl text-sm font-semibold text-label-secondary hover:text-label-primary hover:scale-105 active:scale-95 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="relative z-10 bg-white/90 dark:bg-surface/90 backdrop-blur-xl border-b border-separator/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8">
            {(['API Keys', 'Users', 'Settings', 'Analytics'] as TabType[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-4 text-sm font-bold transition-all border-b-[3px] ${
                  activeTab === tab 
                    ? 'border-brown text-brown' 
                    : 'border-transparent text-label-secondary hover:text-label-primary'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'API Keys' && (
          <div className="space-y-6">
            {/* Category Filter */}
            <div className="flex gap-3">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2.5 rounded-hig-xl text-sm font-bold transition-all ${
                    activeCategory === cat
                      ? 'gradient-brown-teal text-white shadow-brown-glow'
                      : 'bg-white dark:bg-surface text-label-secondary hover:text-label-primary border border-separator'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {providersInCategory.map(([provider, config]) => {
                const values = apiKeys[provider] || { key: '', secret: '', url: '', enabled: false }
                
                return (
                  <div key={provider} className="bg-white dark:bg-surface rounded-hig-3xl p-6 space-y-5 shadow-float border border-separator/50">
                    {/* Provider Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-label-primary mb-1">
                          {config.name}
                        </h3>
                        <p className="text-xs text-label-tertiary">{config.guide}</p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={values.enabled}
                          onChange={(e) => updateField(provider, 'enabled', e.target.checked)}
                          className="w-5 h-5 rounded cursor-pointer accent-brown"
                        />
                        <span className="text-xs font-semibold text-label-secondary">Active</span>
                      </label>
                    </div>

                    {/* Documentation Link */}
                    <a
                      href={config.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-brown hover:text-brown-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      API Documentation
                    </a>

                    {/* API Key Field */}
                    {config.fields.key && (
                      <div>
                        <label className="block text-xs font-bold text-label-secondary uppercase tracking-widest mb-2">
                          API Key *
                        </label>
                        <input
                          type="password"
                          value={values.key}
                          onChange={(e) => updateField(provider, 'key', e.target.value)}
                          placeholder="sk-..."
                          className="w-full h-12 px-4 bg-white dark:bg-surface-tertiary border-2 border-separator rounded-hig-xl text-sm font-mono text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/20 focus:border-brown transition-all"
                        />
                      </div>
                    )}

                    {/* API Secret Field (optional) */}
                    {config.fields.secret && (
                      <div>
                        <label className="block text-xs font-bold text-label-secondary uppercase tracking-widest mb-2">
                          API Secret
                        </label>
                        <input
                          type="password"
                          value={values.secret}
                          onChange={(e) => updateField(provider, 'secret', e.target.value)}
                          placeholder="Optional secret key"
                          className="w-full h-12 px-4 bg-white dark:bg-surface-tertiary border-2 border-separator rounded-hig-xl text-sm font-mono text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/20 focus:border-brown transition-all"
                        />
                      </div>
                    )}

                    {/* Base URL Field (optional) */}
                    {config.fields.url && (
                      <div>
                        <label className="block text-xs font-bold text-label-secondary uppercase tracking-widest mb-2">
                          Base URL
                        </label>
                        <input
                          type="url"
                          value={values.url}
                          onChange={(e) => updateField(provider, 'url', e.target.value)}
                          placeholder="https://api.example.com"
                          className="w-full h-12 px-4 bg-white dark:bg-surface-tertiary border-2 border-separator rounded-hig-xl text-sm font-mono text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/20 focus:border-brown transition-all"
                        />
                      </div>
                    )}

                    {/* Save Button */}
                    <button
                      onClick={() => handleSaveKey(provider)}
                      className="w-full h-12 gradient-brown-teal text-white rounded-hig-xl font-bold shadow-float hover:shadow-hig-hover hover:scale-105 active:scale-95 transition-all"
                    >
                      Save Configuration
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'Users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-label-primary">User Management</h2>
              <div className="text-sm text-label-tertiary">{users.length} total users</div>
            </div>
            
            <div className="bg-white dark:bg-surface rounded-hig-3xl overflow-hidden shadow-float border border-separator/50">
              <table className="w-full">
                <thead className="bg-surface-secondary/50 dark:bg-surface-tertiary/50 border-b border-separator">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-label-secondary uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-label-secondary uppercase tracking-widest">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-label-secondary uppercase tracking-widest">Created</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-label-secondary uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-surface-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-label-primary">{user.email?.split('@')[0]}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-label-secondary">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-label-tertiary">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          user.email_confirmed_at 
                            ? 'bg-success/10 text-success' 
                            : 'bg-warning/10 text-warning'
                        }`}>
                          {user.email_confirmed_at ? 'Active' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-label-primary">General Settings</h2>
            <div className="bg-white dark:bg-surface rounded-hig-3xl p-8 shadow-float border border-separator/50">
              <p className="text-label-secondary">Application settings will be available here.</p>
            </div>
          </div>
        )}

        {activeTab === 'Analytics' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-label-primary">Usage Analytics</h2>
            <div className="bg-white dark:bg-surface rounded-hig-3xl p-8 shadow-float border border-separator/50">
              <p className="text-label-secondary">Analytics dashboard coming soon.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
