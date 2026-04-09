'use client'

import { motion } from 'framer-motion'
import { stagger, cardVariant } from '@/shared/ui/layout/AppLayout'
import { useState, useEffect } from 'react'
import { getAdminSettings, setProviderApiKey, setProviderEnabled } from '@/lib/admin-settings'

const PROVIDERS = [
  { id: 'google', name: 'Google Gemini', envKey: 'GOOGLE_GENERATIVE_AI_API_KEY' },
  { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY' },
  { id: 'anthropic', name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY' },
  { id: 'mistral', name: 'Mistral AI', envKey: 'MISTRAL_API_KEY' },
]

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [enabledProviders, setEnabledProviders] = useState<Record<string, boolean>>({})
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'testing' | 'success' | 'error'>>({})
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  // Load settings on mount
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
    setProviderApiKey(providerId, apiKey)
    setApiKeys(prev => ({ ...prev, [providerId]: apiKey }))
    setEditingProvider(null)
    setSavedMessage(`${PROVIDERS.find(p => p.id === providerId)?.name} API key saved!`)
    setTimeout(() => setSavedMessage(null), 3000)
  }

  const handleToggleEnabled = (providerId: string) => {
    const newEnabled = !enabledProviders[providerId]
    setProviderEnabled(providerId, newEnabled)
    setEnabledProviders(prev => ({ ...prev, [providerId]: newEnabled }))
  }

  const handleTestConnection = async (providerId: string) => {
    setTestStatus(prev => ({ ...prev, [providerId]: 'testing' }))
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Say "Connection successful" in exactly those words.' }],
          model: providerId === 'google' ? 'gemini-2.0-flash' : 
                 providerId === 'openai' ? 'gpt-4o-mini' :
                 providerId === 'anthropic' ? 'claude-3-5-haiku' : 'mistral-medium',
          provider: providerId,
          apiKey: apiKeys[providerId],
          temperature: 0.1,
          maxTokens: 50,
        }),
      })

      if (response.ok) {
        setTestStatus(prev => ({ ...prev, [providerId]: 'success' }))
      } else {
        setTestStatus(prev => ({ ...prev, [providerId]: 'error' }))
      }
    } catch {
      setTestStatus(prev => ({ ...prev, [providerId]: 'error' }))
    }

    setTimeout(() => setTestStatus(prev => ({ ...prev, [providerId]: 'idle' })), 5000)
  }

  return (
    <div className="p-10 bg-surface-secondary min-h-screen">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI API Configuration</h1>
            <p className="text-label-secondary mt-1">Add your API keys to connect directly to AI providers</p>
          </div>
          {savedMessage && (
            <div className="px-4 py-2 bg-success/10 text-success rounded-lg text-sm font-medium">
              {savedMessage}
            </div>
          )}
        </header>

        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {PROVIDERS.map(provider => (
            <motion.div key={provider.id} variants={cardVariant} className="bg-surface border border-separator rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-separator flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${
                    provider.id === 'google' ? 'bg-blue-500' :
                    provider.id === 'openai' ? 'bg-green-600' :
                    provider.id === 'anthropic' ? 'bg-orange-500' : 'bg-purple-500'
                  }`}>
                    {provider.name[0]}
                  </div>
                  <div>
                    <h3 className="font-bold">{provider.name}</h3>
                    <div className={`text-[10px] uppercase font-bold tracking-widest ${
                      apiKeys[provider.id] ? 'text-success' : 'text-label-tertiary'
                    }`}>
                      {apiKeys[provider.id] ? 'Configured' : 'Not Configured'}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => handleTestConnection(provider.id)}
                  disabled={!apiKeys[provider.id] || testStatus[provider.id] === 'testing'}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                    testStatus[provider.id] === 'success' ? 'bg-success/10 text-success' :
                    testStatus[provider.id] === 'error' ? 'bg-destructive/10 text-destructive' :
                    testStatus[provider.id] === 'testing' ? 'bg-blue-500/10 text-blue-500' :
                    'text-primary hover:bg-primary/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {testStatus[provider.id] === 'testing' ? 'Testing...' :
                   testStatus[provider.id] === 'success' ? 'Connected!' :
                   testStatus[provider.id] === 'error' ? 'Failed' : 'Test Connection'}
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">
                    API Key ({provider.envKey})
                  </label>
                  <div className="flex gap-2">
                    {editingProvider === provider.id ? (
                      <>
                        <input 
                          type="text"
                          placeholder="Enter your API key..."
                          defaultValue={apiKeys[provider.id]}
                          className="flex-grow h-10 px-3 bg-fill border border-separator rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveKey(provider.id, (e.target as HTMLInputElement).value)
                            } else if (e.key === 'Escape') {
                              setEditingProvider(null)
                            }
                          }}
                          autoFocus
                        />
                        <button 
                          onClick={(e) => {
                            const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement
                            handleSaveKey(provider.id, input.value)
                          }}
                          className="px-4 gradient-brown-teal text-white rounded-lg text-sm font-medium"
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
                          placeholder="No API key configured"
                          className="flex-grow h-10 px-3 bg-fill border-none rounded-lg text-sm" 
                        />
                        <button 
                          onClick={() => setEditingProvider(provider.id)}
                          className="px-4 bg-surface border border-separator rounded-lg text-sm font-medium hover:bg-fill transition-colors"
                        >
                          {apiKeys[provider.id] ? 'Edit' : 'Add Key'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="pt-4 border-t border-separator flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-label-secondary">Enable Provider</span>
                    <button 
                      onClick={() => handleToggleEnabled(provider.id)}
                      className={`w-12 h-6 rounded-full p-1 transition-colors ${enabledProviders[provider.id] ? 'bg-success' : 'bg-separator'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${enabledProviders[provider.id] ? 'translate-x-6' : ''}`} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="bg-brown-50 dark:bg-brown-900/20 border border-brown-200 dark:border-brown-700 rounded-xl p-6">
          <h3 className="font-bold text-brown-900 dark:text-brown-100 mb-2">How API Keys Work</h3>
          <p className="text-sm text-brown-700 dark:text-brown-300">
            API keys are stored securely in your browser and sent directly to the AI providers when you make requests. 
            Your keys never pass through our servers. Get your API keys from each provider&apos;s dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}
