'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

type TabType = 'API Keys' | 'Users' | 'Settings' | 'Analytics'

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

    // Load API keys from localStorage
    const stored = localStorage.getItem('clox_api_keys')
    if (stored) {
      setApiKeys(JSON.parse(stored))
    }

    // Load users from Supabase
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
    const updated = { ...apiKeys }
    localStorage.setItem('clox_api_keys', JSON.stringify(updated))
    
    // Also sync to Supabase for persistence (future enhancement)
    alert(`${PROVIDER_CONFIG[provider as keyof typeof PROVIDER_CONFIG].name} settings saved!`)
  }

  const handleToggleProvider = (provider: string) => {
    setApiKeys(prev => {
      const updated = {
        ...prev,
        [provider]: {
          ...prev[provider],
          enabled: !prev[provider]?.enabled
        }
      }
      localStorage.setItem('clox_api_keys', JSON.stringify(updated))
      return updated
    })
  }

  const categories = ['Text AI', 'Image AI', 'Video AI', 'Audio AI']
  const providersInCategory = Object.entries(PROVIDER_CONFIG).filter(
    ([, config]) => config.category === activeCategory
  )

  const tabs: TabType[] = ['API Keys', 'Users', 'Settings', 'Analytics']

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-brown-50 to-teal-50 dark:from-[#1C1C1E] dark:via-[#2C2C2E] dark:to-[#1C1C1E]">
        <div className="text-2xl font-bold text-brown">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-white via-brown-50 to-teal-50 dark:from-[#1C1C1E] dark:via-[#2C2C2E] dark:to-[#1C1C1E]">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-brown/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-teal/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl animate-blob [animation-delay:2s]"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-brown-300/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl animate-blob [animation-delay:4s]"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border-b border-brown-200/50 dark:border-brown-700/50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-brown-900 dark:text-brown-100">Super Admin Dashboard</h1>
              <p className="text-sm text-brown-600 dark:text-brown-400 mt-1">Manage all AI providers and system settings</p>
            </div>
            <button
              onClick={() => router.push('/text')}
              className="px-6 py-3 gradient-brown-teal text-white rounded-hig-xl font-bold shadow-brown-glow hover:scale-105 transition-transform"
            >
              Go to App →
            </button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="relative z-10 bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-xl border-b border-brown-200/30 dark:border-brown-700/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-bold text-sm transition-all relative ${
                  activeTab === tab
                    ? 'text-brown-900 dark:text-brown-100'
                    : 'text-brown-500 dark:text-brown-500 hover:text-brown-700 dark:hover:text-brown-300'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 gradient-brown-teal rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'API Keys' && (
          <div className="space-y-6">
            {/* Category Tabs */}
            <div className="flex gap-3 p-2 bg-white/60 dark:bg-[#2C2C2E]/60 backdrop-blur-xl rounded-hig-xl border border-brown-200 dark:border-brown-700 shadow-sm">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex-1 px-6 py-3 rounded-hig-lg font-bold text-sm transition-all ${
                    activeCategory === cat
                      ? 'gradient-brown-teal text-white shadow-brown-glow'
                      : 'text-brown-600 dark:text-brown-400 hover:bg-brown-50 dark:hover:bg-brown-900/20'
                  }`}
                >
                  {cat}
                  <span className="ml-2 text-xs opacity-70">
                    ({Object.values(PROVIDER_CONFIG).filter(p => p.category === cat).length})
                  </span>
                </button>
              ))}
            </div>

            {/* Provider Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {providersInCategory.map(([key, config]) => {
                const providerData = apiKeys[key] || { key: '', secret: '', url: '', enabled: false }
                
                return (
                  <div
                    key={key}
                    className="bg-white/90 dark:bg-[#2C2C2E]/90 backdrop-blur-xl rounded-hig-2xl border border-brown-200 dark:border-brown-700 p-6 shadow-float hover:shadow-brown-glow transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-brown-900 dark:text-brown-100">{config.name}</h3>
                        <p className="text-xs text-brown-600 dark:text-brown-400 mt-1">{config.category}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={providerData.enabled}
                          onChange={() => handleToggleProvider(key)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-brown-200 dark:bg-brown-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-brown-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-brown peer-checked:to-teal"></div>
                      </label>
                    </div>

                    <div className="space-y-3">
                      {config.fields.key && (
                        <div>
                          <label className="block text-xs font-bold text-brown-700 dark:text-brown-300 mb-1">API Key</label>
                          <input
                            type="password"
                            value={providerData.key}
                            onChange={(e) => setApiKeys(prev => ({ ...prev, [key]: { ...prev[key], key: e.target.value } }))}
                            placeholder="sk-..."
                            className="w-full px-3 py-2 bg-brown-50 dark:bg-brown-900/30 border border-brown-200 dark:border-brown-700 rounded-hig-lg text-sm text-brown-900 dark:text-brown-100 placeholder:text-brown-400 focus:ring-2 focus:ring-teal-400 outline-none"
                          />
                        </div>
                      )}
                      
                      {config.fields.secret && (
                        <div>
                          <label className="block text-xs font-bold text-brown-700 dark:text-brown-300 mb-1">API Secret</label>
                          <input
                            type="password"
                            value={providerData.secret}
                            onChange={(e) => setApiKeys(prev => ({ ...prev, [key]: { ...prev[key], secret: e.target.value } }))}
                            placeholder="secret..."
                            className="w-full px-3 py-2 bg-brown-50 dark:bg-brown-900/30 border border-brown-200 dark:border-brown-700 rounded-hig-lg text-sm text-brown-900 dark:text-brown-100 placeholder:text-brown-400 focus:ring-2 focus:ring-teal-400 outline-none"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => handleSaveKey(key)}
                          className="flex-1 px-4 py-2 bg-gradient-to-r from-brown to-teal text-white rounded-hig-lg font-bold text-sm hover:scale-105 transition-transform shadow-sm"
                        >
                          Save
                        </button>
                        <a
                          href={config.docs}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-brown-100 dark:bg-brown-800 text-brown-700 dark:text-brown-300 rounded-hig-lg font-bold text-sm hover:bg-brown-200 dark:hover:bg-brown-700 transition-colors"
                        >
                          Docs
                        </a>
                      </div>

                      <p className="text-xs text-brown-500 dark:text-brown-500 leading-relaxed">
                        {config.guide}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'Users' && (
          <div className="bg-white/90 dark:bg-[#2C2C2E]/90 backdrop-blur-xl rounded-hig-2xl border border-brown-200 dark:border-brown-700 p-6 shadow-float">
            <h2 className="text-2xl font-bold text-brown-900 dark:text-brown-100 mb-6">User Management</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brown-200 dark:border-brown-700">
                    <th className="text-left py-3 px-4 text-sm font-bold text-brown-700 dark:text-brown-300">Email</th>
                    <th className="text-left py-3 px-4 text-sm font-bold text-brown-700 dark:text-brown-300">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-bold text-brown-700 dark:text-brown-300">Created</th>
                    <th className="text-left py-3 px-4 text-sm font-bold text-brown-700 dark:text-brown-300">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id} className="border-b border-brown-100 dark:border-brown-800">
                      <td className="py-4 px-4 text-sm text-brown-900 dark:text-brown-100">{user.email}</td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          user.email_confirmed_at
                            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                            : 'bg-brown-100 dark:bg-brown-800 text-brown-700 dark:text-brown-300'
                        }`}>
                          {user.email_confirmed_at ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-brown-600 dark:text-brown-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <button className="text-sm font-bold text-brown-600 dark:text-brown-400 hover:text-brown-900 dark:hover:text-brown-100">
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Settings' && (
          <div className="bg-white/90 dark:bg-[#2C2C2E]/90 backdrop-blur-xl rounded-hig-2xl border border-brown-200 dark:border-brown-700 p-6 shadow-float">
            <h2 className="text-2xl font-bold text-brown-900 dark:text-brown-100 mb-4">System Settings</h2>
            <p className="text-brown-600 dark:text-brown-400">Global configuration options coming soon...</p>
          </div>
        )}

        {activeTab === 'Analytics' && (
          <div className="bg-white/90 dark:bg-[#2C2C2E]/90 backdrop-blur-xl rounded-hig-2xl border border-brown-200 dark:border-brown-700 p-6 shadow-float">
            <h2 className="text-2xl font-bold text-brown-900 dark:text-brown-100 mb-4">Usage Analytics</h2>
            <p className="text-brown-600 dark:text-brown-400">API usage statistics and metrics coming soon...</p>
          </div>
        )}
      </div>
    </div>
  )
}
