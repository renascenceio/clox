'use client'

import { useChat } from '@ai-sdk/react'
import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar from '@/shared/ui/layout/ChatSidebar'
import ProjectPanel from './ProjectPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { TEXT_MODELS } from '@/domains/text-generation/services/model-router'
import { useRouter } from 'next/navigation'
import { getAdminSettings } from '@/lib/admin-settings'
import { createClient } from '@/lib/supabase/client'

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
  const [activeChatId, setActiveChatId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeChatId') || 'default-chat'
    }
    return 'default-chat'
  })

  // Project collaboration state
  const isProject = activeChatId.startsWith('project_')
  const [dbProjectId, setDbProjectId] = useState<string | null>(null)
  const [projectMessages, setProjectMessages] = useState<Array<{
    id: string; role: 'user' | 'assistant'; content: string; sender_email?: string; sender_name?: string; created_at: string
  }>>([])

  // Load project messages from DB
  const loadProjectMessages = useCallback(async (projectId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('project_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
    if (data) setProjectMessages(data)
  }, [])

  const handleProjectResolved = useCallback((id: string | null) => {
    setDbProjectId(id)
    if (id) loadProjectMessages(id)
  }, [loadProjectMessages])

  // Save a project message to DB
  const saveProjectMessage = useCallback(async (
    projectId: string,
    role: 'user' | 'assistant',
    content: string,
    senderEmail?: string,
    senderName?: string,
  ) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('project_messages').insert({
      project_id: projectId,
      user_id: role === 'user' ? user?.id : null,
      sender_email: role === 'user' ? (senderEmail || user?.email) : null,
      sender_name: role === 'user' ? senderName : 'AI',
      role,
      content,
      model: selectedModel.id,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel.id])

  // Load chat-specific settings when activeChatId changes
  useEffect(() => {
    const savedSettings = localStorage.getItem(`chat-settings-${activeChatId}`)
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings)
        if (settings.modelId) {
          const model = TEXT_MODELS.find(m => m.id === settings.modelId)
          if (model) {
            setSelectedModel(model)
            setSelectedBrand(model.brandName || model.provider)
          }
        }
        if (settings.systemPrompt !== undefined) setSystemPrompt(settings.systemPrompt)
        if (settings.temperature !== undefined) setTemperature(settings.temperature)
        if (settings.maxTokens !== undefined) setMaxTokens(settings.maxTokens)
      } catch (e) {
        console.error('[v0] Failed to load chat settings:', e)
      }
    }
  }, [activeChatId])

  // Save chat-specific settings when they change
  useEffect(() => {
    const settings = {
      modelId: selectedModel.id,
      systemPrompt,
      temperature,
      maxTokens,
    }
    localStorage.setItem(`chat-settings-${activeChatId}`, JSON.stringify(settings))
  }, [activeChatId, selectedModel.id, systemPrompt, temperature, maxTokens])
  
  // Load saved model from localStorage on mount and filter models
  useEffect(() => {
    const settings = getAdminSettings()
    const filtered = TEXT_MODELS.filter(model => {
      const isEnabled = settings.providers[model.provider]?.enabled ?? true // Default to true if not set
      return isEnabled
    })
    setEnabledModels(filtered)
    
    // Try to load saved model from localStorage
    const savedModelId = localStorage.getItem('selectedTextModelId')
    if (savedModelId) {
      const savedModel = filtered.find(m => m.id === savedModelId)
      if (savedModel) {
        setSelectedModel(savedModel)
        setSelectedBrand(savedModel.brandName || savedModel.provider)
        return
      }
    }
    
    // Fallback to first enabled model if no saved model or saved model not found
    if (filtered.length > 0 && !filtered.find(m => m.id === selectedModel.id)) {
      setSelectedModel(filtered[0])
      setSelectedBrand(filtered[0].brandName || filtered[0].provider)
    }
  }, [selectedModel.id])
  
  // Get API key from admin settings - refreshed each render
  const [currentApiKey, setCurrentApiKey] = useState('')
  
  // Refresh API key when provider changes or on mount
  useEffect(() => {
    const settings = getAdminSettings()
    const key = settings.providers[selectedModel.provider]?.apiKey || ''
    setCurrentApiKey(key)
    console.log('[v0] API key loaded for provider:', selectedModel.provider, 'hasKey:', !!key)
  }, [selectedModel.provider])

  const chat = useChat({
    id: activeChatId,
    api: '/api/chat',
    body: {
      model: selectedModel.id,
      provider: selectedModel.provider,
      systemPrompt,
      temperature,
      maxTokens,
      apiKey: currentApiKey,
    },
    onError: (error) => {
      console.error('[v0] Chat API error:', error)
      alert(`Chat error: ${error.message || 'Unknown error'}`)
    },
    onResponse: (response) => {
      if (!response.ok) console.error('[v0] Chat response not ok:', response.statusText)
    },
    onFinish: async (message) => {
      // For projects: save the AI response to DB
      if (isProject && dbProjectId) {
        await saveProjectMessage(dbProjectId, 'assistant', message.content)
        await loadProjectMessages(dbProjectId)
      }
    },
  })

  // Extract chat properties early so they can be used in useEffect dependencies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages = [], input = '', handleInputChange, handleSubmit, isLoading = false, setMessages } = chat as any

  // Save chat history to localStorage (skip for projects — those go to DB)
  useEffect(() => {
    if (isProject) return
    if (chat.messages && chat.messages.length > 0) {
      localStorage.setItem(`chat-history-${activeChatId}`, JSON.stringify(chat.messages))
    }
  }, [chat.messages, activeChatId, isProject])

  // Load chat history from localStorage (skip for projects)
  useEffect(() => {
    if (isProject) {
      if (setMessages) setMessages([])
      return
    }
    const savedHistory = localStorage.getItem(`chat-history-${activeChatId}`)
    if (savedHistory && setMessages) {
      try {
        setMessages(JSON.parse(savedHistory))
      } catch (e) {
        console.error('[v0] Failed to parse chat history:', e)
      }
    } else if (setMessages) {
      setMessages([])
    }
  }, [activeChatId, setMessages, isProject])

  // Reset project state when switching away from a project
  useEffect(() => {
    if (!isProject) {
      setDbProjectId(null)
      setProjectMessages([])
    }
  }, [isProject])

  // Project form submit: save user message first, then trigger AI
  const handleProjectSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    if (!dbProjectId) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (input?.trim()) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user?.id || '')
        .single()
      const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : user?.email?.split('@')[0]
      await saveProjectMessage(dbProjectId, 'user', input.trim(), user?.email, name)
      // Optimistically add to local state
      setProjectMessages(prev => [...prev, {
        id: `tmp_${Date.now()}`, role: 'user', content: input.trim(),
        sender_email: user?.email, sender_name: name, created_at: new Date().toISOString(),
      }])
    }
    handleSubmit(e)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbProjectId, input, saveProjectMessage, handleSubmit])

  // Get unique brands and models for selected brand (only from enabled models)
  const brands = Array.from(new Set(enabledModels.map(m => m.brandName || m.provider)))

  const handleModelChange = (modelId: string) => {
    const model = enabledModels.find(m => m.id === modelId)
    if (model) {
      setSelectedModel(model)
      setSelectedBrand(model.brandName || model.provider)
      // Persist selected model to localStorage
      localStorage.setItem('selectedTextModelId', model.id)
    }
  }

  const handleAITypeChange = (type: AIType) => {
    setActiveAIType(type)
    // Navigate to the respective page
    if (type !== 'text') {
      router.push(`/${type}`)
    }
  }

  // Handle chat selection from sidebar
  const handleChatSelect = (chatId: string) => {
    console.log('[v0] Chat selected:', chatId)
    setActiveChatId(chatId)
    localStorage.setItem('activeChatId', chatId)
  }

  const sidebar = (
    <ChatSidebar activeChatId={activeChatId} onChatSelect={handleChatSelect} />
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

  const rightPanel = isProject ? (
    <ProjectPanel
      localChatId={activeChatId}
      onProjectResolved={handleProjectResolved}
      selectedModel={selectedModel.id}
      systemPrompt={systemPrompt}
      onSystemPromptChange={setSystemPrompt}
      temperature={temperature}
      onTemperatureChange={setTemperature}
      maxTokens={maxTokens}
      onMaxTokensChange={setMaxTokens}
    />
  ) : (
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

  // Messages to display: project uses DB messages, chats use useChat messages
  type DisplayMessage = { id: string; role: string; content: string; senderName?: string | null; senderEmail?: string | null }
  const displayMessages: DisplayMessage[] = isProject
    ? projectMessages.map(m => ({ id: m.id, role: m.role, content: m.content, senderName: m.sender_name, senderEmail: m.sender_email }))
    : (messages as DisplayMessage[]).map(m => ({ id: m.id, role: m.role, content: m.content }))

  const displayLoading = isLoading

  return (
    <AppLayout sidebar={sidebar} rightPanel={rightPanel}>
      <div className="flex flex-col h-full max-w-4xl mx-auto px-4 pt-10">
        {/* Scrollable Messages Container */}
        <div className="flex-grow overflow-y-auto space-y-8 pr-4 pb-72">
          <AnimatePresence initial={false}>
            {displayMessages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  {/* Sender label for project mode */}
                  {isProject && m.role === 'user' && m.senderName && (
                    <span className="text-[10px] font-semibold text-label-tertiary px-1">{m.senderName}</span>
                  )}
                  <div className={m.role === 'user'
                    ? 'text-brown dark:text-teal font-semibold text-sm leading-relaxed'
                    : 'prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-surface-tertiary dark:prose-pre:bg-surface prose-pre:p-4 prose-pre:rounded-lg prose-code:text-brown dark:prose-code:text-teal prose-code:bg-surface-tertiary/50 dark:prose-code:bg-surface/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-headings:text-label-primary prose-strong:text-label-primary prose-a:text-brown dark:prose-a:text-teal prose-a:no-underline hover:prose-a:underline'
                  }>
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {/* Thinking Indicator */}
            {displayLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex items-start gap-3 max-w-[85%]">
                  {/* AI Avatar */}
                  <div className="w-8 h-8 rounded-full gradient-brown-teal flex items-center justify-center flex-shrink-0 shadow-brown-glow">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  
                  {/* Thinking Content */}
                  <div className="bg-surface-tertiary/60 dark:bg-surface/60 rounded-hig-xl px-4 py-3 border border-separator/30">
                    <div className="flex items-center gap-2 text-sm text-label-secondary">
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-brown dark:bg-teal rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-brown dark:bg-teal rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-brown dark:bg-teal rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-xs font-medium text-label-tertiary ml-2">
                        {selectedBrand} is thinking...
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Message Input with Integrated Tabs - Fixed at bottom */}
        <div className="fixed bottom-0 left-[304px] right-[368px] p-6 bg-gradient-to-t from-surface-secondary/95 via-surface-secondary/90 to-transparent dark:from-surface-secondary/95 dark:via-surface-secondary/90 dark:to-transparent backdrop-blur-sm pointer-events-none z-40">
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
              <form onSubmit={isProject ? handleProjectSubmit : handleSubmit} className="relative">
                <textarea
                  value={input}
                  onChange={handleInputChange}
                  placeholder={`Message ${activeAIType} AI... (⌘+Enter to send • ${activeAIType.charAt(0).toUpperCase() + activeAIType.slice(1)} mode)`}
                  className="w-full min-h-[80px] max-h-[240px] p-6 pl-16 pr-16 bg-white dark:bg-[#2C2C2E] outline-none resize-none font-medium placeholder:text-label-tertiary text-label-primary"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      const formEvent = new Event('submit', { cancelable: true }) as unknown as React.FormEvent<HTMLFormElement>
                      if (isProject) handleProjectSubmit(formEvent)
                      else handleSubmit(formEvent)
                    }
                  }}
                />
                {/* File Upload Button */}
                <button
                  type="button"
                  className="absolute left-4 bottom-4 w-10 h-10 flex items-center justify-center text-label-secondary hover:text-brown dark:hover:text-teal transition-all hover:scale-110 active:scale-95"
                  title="Attach files or images"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                {/* Send Button */}
                <button
                  type="submit"
                  disabled={displayLoading || !input?.trim() || (isProject && !dbProjectId)}
                  className="absolute right-4 bottom-4 w-12 h-12 flex items-center justify-center gradient-brown-teal text-white rounded-hig-xl shadow-brown-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3.33331V12.6666M8 3.33331L4 7.33331M8 3.33331L12 7.33331" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
