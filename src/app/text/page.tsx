'use client'

import { useChat } from '@ai-sdk/react'
import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { TEXT_MODELS } from '@/domains/text-generation/services/model-router'
import { useRouter } from 'next/navigation'
import { getAdminSettings } from '@/lib/admin-settings'

type AIType = 'text' | 'image' | 'video' | 'audio'

export default function TextPage() {
  const router = useRouter()
  
  // Start with all models, will filter client-side
  const [enabledModels, setEnabledModels] = useState(TEXT_MODELS)
  const [selectedModel, setSelectedModel] = useState<typeof TEXT_MODELS[number]>(TEXT_MODELS[0])
  const [selectedBrand, setSelectedBrand] = useState<string>(TEXT_MODELS[0].brandName || TEXT_MODELS[0].provider)
  const [activeAIType, setActiveAIType] = useState<AIType>('text')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2048)
  
  // Filter models based on enabled providers in admin (client-side only to avoid hydration issues)
  useEffect(() => {
    const settings = getAdminSettings()
    const filtered = TEXT_MODELS.filter(model => {
      const isEnabled = settings.providers[model.provider]?.enabled ?? true // Default to true if not set
      return isEnabled
    })
    setEnabledModels(filtered)
    if (filtered.length > 0 && !filtered.find(m => m.id === selectedModel.id)) {
      setSelectedModel(filtered[0])
      setSelectedBrand(filtered[0].brandName || filtered[0].provider)
    }
  }, [selectedModel.id])
  
  const chat = useChat({
    api: '/api/chat',
    body: {
      model: selectedModel.id,
      provider: selectedModel.provider,
      systemPrompt,
      temperature,
      maxTokens,
    },
    onError: (error) => {
      console.error('[v0] Chat API error:', error)
      alert(`Chat error: ${error.message || 'Unknown error'}`)
    },
    onResponse: (response) => {
      console.log('[v0] Chat response received, status:', response.status)
      if (!response.ok) {
        console.error('[v0] Chat response not ok:', response.statusText)
      }
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages = [], input = '', handleInputChange, handleSubmit, isLoading = false } = chat as any

  // Get unique brands and models for selected brand (only from enabled models)
  const brands = Array.from(new Set(enabledModels.map(m => m.brandName || m.provider)))

  const handleModelChange = (modelId: string) => {
    const model = enabledModels.find(m => m.id === modelId)
    if (model) {
      setSelectedModel(model)
      setSelectedBrand(model.brandName || model.provider)
    }
  }

  const handleAITypeChange = (type: AIType) => {
    setActiveAIType(type)
    // Navigate to the respective page
    if (type !== 'text') {
      router.push(`/${type}`)
    }
  }

  const sidebar = (
    <ChatSidebar>
       <SidebarItem title="Initial prompt..." active />
       <SidebarItem title="Refining the code" />
       <SidebarItem title="Marketing ideas" />
    </ChatSidebar>
  )

  const aiTypeIcons = {
    text: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    image: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    video: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    audio: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  }

  const rightPanel = (
    <div className="flex flex-col h-full">
      <div className="h-16 border-b border-separator/50 flex items-center px-6">
        <span className="font-bold text-sm">Settings</span>
      </div>
      <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-6">
        {/* AI Model Header - Match Image Format */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-label-primary">AI Model</h3>
            <div className="w-2 h-2 bg-brown dark:bg-teal rounded-full animate-pulse"></div>
          </div>
          
          {/* Model Selector */}
          <select
            value={selectedModel.id}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full h-11 px-4 bg-white dark:bg-[#2C2C2E] border-2 border-separator rounded-hig-lg text-sm font-bold text-label-primary focus:outline-none focus:ring-2 focus:ring-brown/20 dark:focus:ring-teal/20 focus:border-brown dark:focus:border-teal transition-all"
          >
            {brands.map(brand => {
              const modelsForBrand = enabledModels.filter(m => (m.brandName || m.provider) === brand)
              return (
                <optgroup key={brand} label={brand}>
                  {modelsForBrand.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.version || model.name}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>

          {/* Current Selection Badge */}
          <div className="px-3 py-2 bg-brown-50 dark:bg-brown-900/20 border border-brown-200 dark:border-brown-700 rounded-hig-lg">
            <p className="text-xs font-bold text-brown-700 dark:text-brown-300">{selectedBrand} • {selectedModel.version || selectedModel.name}</p>
          </div>
        </div>

        {/* System Prompt */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-label-tertiary uppercase tracking-widest">System Prompt</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful assistant..."
            className="w-full min-h-[100px] p-3 bg-white dark:bg-[#2C2C2E] border-2 border-separator rounded-hig-lg text-sm text-label-primary placeholder:text-label-tertiary focus:outline-none focus:ring-2 focus:ring-brown/20 focus:border-brown transition-all resize-none"
            rows={4}
          />
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-label-tertiary uppercase tracking-widest">Temperature</label>
            <span className="text-sm font-bold text-brown">{temperature}</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer accent-brown"
          />
          <div className="flex justify-between text-xs text-label-tertiary">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-label-tertiary uppercase tracking-widest">Max Tokens</label>
            <span className="text-sm font-bold text-teal-600">{maxTokens}</span>
          </div>
          <input
            type="range"
            min="256"
            max="8192"
            step="256"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="w-full h-2 bg-surface-secondary rounded-lg appearance-none cursor-pointer accent-teal"
          />
          <div className="flex justify-between text-xs text-label-tertiary">
            <span>256</span>
            <span>8192</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <AppLayout sidebar={sidebar} rightPanel={rightPanel}>
      <div className="flex flex-col h-full max-w-4xl mx-auto px-4 pt-10 pb-48">
        <div className="flex-grow space-y-8">
          <AnimatePresence initial={false}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {messages.map((m: any) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'text-brown dark:text-teal font-semibold'
                    : 'prose prose-sm max-w-none text-label-primary'
                }`}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Message Input with Integrated Tabs - Fixed at bottom */}
        <div className="fixed bottom-0 left-[304px] right-[368px] p-6 bg-gradient-to-t from-surface-secondary/95 via-surface-secondary/90 to-transparent dark:from-surface-secondary/95 dark:via-surface-secondary/90 dark:to-transparent backdrop-blur-sm pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            {/* Tabbed Message Input Box */}
            <div className="glass-float rounded-hig-2xl shadow-float overflow-hidden border border-separator/50">
              {/* AI Type Tabs - Integrated into message box */}
              <div className="flex items-center border-b border-separator/30 bg-surface-secondary/40 dark:bg-[#2C2C2E]/40 backdrop-blur-sm">
                {(['text', 'image', 'video', 'audio'] as AIType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleAITypeChange(type)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${
                      activeAIType === type
                        ? 'border-brown dark:border-teal bg-white dark:bg-[#2C2C2E] text-brown dark:text-teal'
                        : 'border-transparent text-label-tertiary hover:text-label-primary hover:bg-white/30 dark:hover:bg-[#2C2C2E]/30'
                    }`}
                  >
                    {aiTypeIcons[type]}
                    <span>{type}</span>
                  </button>
                ))}
              </div>

              {/* Message Input Form */}
              <form onSubmit={handleSubmit} className="relative">
                <textarea
                  value={input}
                  onChange={handleInputChange}
                  placeholder={`Message ${activeAIType} AI...`}
                  className="w-full min-h-[80px] max-h-[240px] p-6 pr-16 bg-white dark:bg-[#2C2C2E] outline-none resize-none font-medium placeholder:text-label-tertiary text-label-primary"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      const formEvent = new Event('submit', { cancelable: true }) as unknown as React.FormEvent<HTMLFormElement>;
                      handleSubmit(formEvent)
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input?.trim()}
                  className="absolute right-4 bottom-4 w-12 h-12 flex items-center justify-center gradient-brown-teal text-white rounded-hig-xl shadow-brown-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3.33331V12.6666M8 3.33331L4 7.33331M8 3.33331L12 7.33331" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </form>
            </div>
            
            <div className="text-center text-xs text-label-tertiary font-medium mt-3">
              ⌘+Enter to send • {activeAIType.charAt(0).toUpperCase() + activeAIType.slice(1)} mode
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
