'use client'

import { useChat } from '@ai-sdk/react'
import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar from '@/shared/ui/layout/ChatSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { TEXT_MODELS } from '@/domains/text-generation/services/model-router'
import { useRouter } from 'next/navigation'
import { getAdminSettings } from '@/lib/admin-settings'
import { useAvailableModels } from '@/lib/use-available-models'
import {
  getActiveChatId,
  setActiveChatId as persistActiveChatId,
  ensureActiveChat,
  touchChat,
} from '@/lib/chat-store'

type AIType = 'text' | 'image' | 'video' | 'audio'

export default function TextPage() {
  const router = useRouter()

  const enabledModels = useAvailableModels(TEXT_MODELS)
  const [selectedModel, setSelectedModel] = useState<typeof TEXT_MODELS[number]>(TEXT_MODELS[0])
  const [selectedBrand, setSelectedBrand] = useState<string>(TEXT_MODELS[0].brandName || TEXT_MODELS[0].provider)
  const [activeAIType, setActiveAIType] = useState<AIType>('text')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2048)
  const [showConfigDrawer, setShowConfigDrawer] = useState(true)

  const [activeChatId, setActiveChatId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default-chat'
    return (
      getActiveChatId('text') ||
      localStorage.getItem('activeChatId') ||
      'default-chat'
    )
  })

  // Load chat-specific settings when activeChatId changes.
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

  useEffect(() => {
    const settings = { modelId: selectedModel.id, systemPrompt, temperature, maxTokens }
    localStorage.setItem(`chat-settings-${activeChatId}`, JSON.stringify(settings))
  }, [activeChatId, selectedModel.id, systemPrompt, temperature, maxTokens])

  // Toggle config drawer with ⌘. — matches the chat-workspace reference.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault()
        setShowConfigDrawer(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Keep selected model valid as the available list updates.
  useEffect(() => {
    if (enabledModels.length === 0) return
    const savedModelId =
      typeof window !== 'undefined' ? localStorage.getItem('selectedTextModelId') : null
    const preferred = savedModelId ? enabledModels.find(m => m.id === savedModelId) : undefined
    const current = enabledModels.find(m => m.id === selectedModel.id)
    if (!current) {
      const next = preferred || enabledModels[0]
      setSelectedModel(next)
      setSelectedBrand(next.brandName || next.provider)
    }
  }, [enabledModels, selectedModel.id])

  const [currentApiKey, setCurrentApiKey] = useState('')

  useEffect(() => {
    const settings = getAdminSettings()
    const key = settings.providers[selectedModel.provider]?.apiKey || ''
    setCurrentApiKey(key)
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
    },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages = [], input = '', handleInputChange, handleSubmit, isLoading = false, setMessages } = chat as any

  // Persist & rehydrate chat history per active chat id.
  useEffect(() => {
    if (chat.messages && chat.messages.length > 0) {
      localStorage.setItem(`chat-history-${activeChatId}`, JSON.stringify(chat.messages))
    }
  }, [chat.messages, activeChatId])

  useEffect(() => {
    const savedHistory = localStorage.getItem(`chat-history-${activeChatId}`)
    if (savedHistory && setMessages) {
      try {
        setMessages(JSON.parse(savedHistory))
      } catch {
        setMessages([])
      }
    } else if (setMessages) {
      setMessages([])
    }
  }, [activeChatId, setMessages])

  const brands = Array.from(new Set(enabledModels.map(m => m.brandName || m.provider)))

  const handleModelChange = (modelId: string) => {
    const model = enabledModels.find(m => m.id === modelId)
    if (model) {
      setSelectedModel(model)
      setSelectedBrand(model.brandName || model.provider)
      localStorage.setItem('selectedTextModelId', model.id)
    }
  }

  const handleAITypeChange = (type: AIType) => {
    setActiveAIType(type)
    if (type !== 'text') router.push(`/${type}`)
  }

  const handleChatSelect = (chatId: string) => {
    setActiveChatId(chatId)
    persistActiveChatId('text', chatId)
  }

  const handleSubmitWithChat = (e: React.FormEvent<HTMLFormElement>) => {
    const promptText = (input || '').trim()
    if (promptText) {
      const c = ensureActiveChat('text', promptText, selectedModel.name)
      if (c.id !== activeChatId) {
        setActiveChatId(c.id)
        persistActiveChatId('text', c.id)
      } else {
        touchChat(c.id, { model: selectedModel.name })
      }
    }
    handleSubmit(e)
  }

  const sidebar = (
    <ChatSidebar modality="text" activeChatId={activeChatId} onChatSelect={handleChatSelect} />
  )

  // Right panel — editorial config drawer. Toggled by ⌘. or the meta button.
  const rightPanel = showConfigDrawer ? (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-5 pb-4 border-b border-hairline">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">configure</div>
        <h3 className="font-serif italic text-2xl text-ink mt-1">This turn</h3>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">
        {/* Model */}
        <section className="space-y-2">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">model</div>
          <select
            value={selectedModel.id}
            onChange={(e) => handleModelChange(e.target.value)}
            className="w-full h-9 px-3 bg-bg border border-hairline rounded-card text-[13px] text-ink outline-none focus:border-ink/40 transition-colors"
          >
            {brands.map(brand => {
              const modelsForBrand = enabledModels.filter(m => (m.brandName || m.provider) === brand)
              return (
                <optgroup key={brand} label={brand}>
                  {modelsForBrand.map(model => (
                    <option key={model.id} value={model.id}>{model.version || model.name}</option>
                  ))}
                </optgroup>
              )
            })}
          </select>
          <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">{selectedBrand} · {selectedModel.version || selectedModel.name}</div>
        </section>

        {/* System prompt */}
        <section className="space-y-2">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">system prompt</div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are a thoughtful editor…"
            className="w-full min-h-[96px] p-3 bg-bg border border-hairline rounded-card text-[13px] text-ink placeholder:text-ink-muted outline-none focus:border-ink/40 resize-none"
          />
        </section>

        {/* Temperature */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">temperature</div>
            <div className="font-mono text-[11px] tracking-[0.04em] text-accent">{temperature.toFixed(1)}</div>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between font-mono text-[10px] text-ink-muted">
            <span>precise</span>
            <span>creative</span>
          </div>
        </section>

        {/* Max tokens */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">max tokens</div>
            <div className="font-mono text-[11px] tracking-[0.04em] text-accent">{maxTokens}</div>
          </div>
          <input
            type="range"
            min="256"
            max="8192"
            step="256"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="w-full accent-accent"
          />
        </section>
      </div>
      <div className="px-6 py-3 border-t border-hairline flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">⌘. to toggle</span>
        <button
          onClick={() => setShowConfigDrawer(false)}
          className="font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink"
        >
          close
        </button>
      </div>
    </div>
  ) : undefined

  // Friendly title for the top strip — falls back to the model name when there's
  // no chat title yet.
  const topTitle =
    messages.length > 0
      ? (messages[0]?.content || '').toString().split('\n')[0].slice(0, 64) || 'New thread'
      : 'New thread'

  return (
    <AppLayout sidebar={sidebar} rightPanel={rightPanel}>
      {/* ============================================================== */}
      {/* Top strip                                                       */}
      {/* ============================================================== */}
      <header className="flex items-center justify-between px-8 pt-5 pb-4 border-b border-hairline-soft">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">
            chat · {selectedBrand.toLowerCase()}
          </div>
          <h1 className="font-serif italic text-[26px] leading-tight tracking-[-0.005em] text-ink truncate mt-1">
            {topTitle}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-6">
          <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted hidden md:inline">
            t {temperature.toFixed(1)} · {maxTokens} tok
          </span>
          <button
            onClick={() => setShowConfigDrawer(v => !v)}
            className="px-3 h-8 inline-flex items-center gap-2 border border-hairline rounded-sharp font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink hover:border-ink/30 transition-colors"
            title="Configure (⌘.)"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
              <path d="M1 2.5h9M1 5.5h9M1 8.5h9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
            configure
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* Messages                                                        */}
      {/* ============================================================== */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[760px] mx-auto px-8 pt-8 pb-[260px] space-y-10">
          <AnimatePresence initial={false}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {messages.map((m: any, i: number) => (
              <motion.div
                key={m.id ?? i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={m.role === 'user' ? 'flex justify-end' : ''}
              >
                {m.role === 'user' ? (
                  // YOU — right-aligned ink-on-paper block.
                  <div className="max-w-[78%] bg-surface-alt border border-hairline-soft rounded-card px-4 py-3">
                    <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted mb-1.5">you</div>
                    <div className="text-[15px] leading-[1.55] text-ink whitespace-pre-wrap">{m.content}</div>
                  </div>
                ) : (
                  // AI — serif "C" mark + accent byline + surface card.
                  <div className="flex gap-4">
                    <div className="flex-none w-7 h-7 mt-0.5 inline-flex items-center justify-center font-serif italic text-[18px] leading-none text-accent select-none">
                      C
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3 mb-2">
                        <span className="font-serif italic text-[15px] text-accent">Clox</span>
                        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                          {selectedBrand.toLowerCase()} · {selectedModel.version || selectedModel.name}
                        </span>
                      </div>
                      <div className="bg-surface border border-hairline rounded-card px-5 py-4 prose prose-sm dark:prose-invert max-w-none
                        prose-p:my-2 prose-p:leading-[1.6] prose-p:text-ink
                        prose-headings:font-serif prose-headings:italic prose-headings:font-medium prose-headings:text-ink prose-headings:tracking-[-0.005em]
                        prose-strong:text-ink prose-em:text-ink-soft
                        prose-a:text-accent prose-a:no-underline hover:prose-a:underline
                        prose-code:font-mono prose-code:text-[12px] prose-code:bg-surface-alt prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-ink
                        prose-pre:bg-rail prose-pre:border prose-pre:border-hairline-soft prose-pre:rounded-card prose-pre:p-4
                        prose-blockquote:border-l-2 prose-blockquote:border-accent prose-blockquote:bg-transparent prose-blockquote:font-serif prose-blockquote:italic prose-blockquote:text-ink-soft prose-blockquote:not-italic
                        prose-hr:border-hairline">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {/* Thinking indicator */}
            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                <div className="flex-none w-7 h-7 mt-0.5 inline-flex items-center justify-center font-serif italic text-[18px] leading-none text-accent select-none">
                  C
                </div>
                <div className="flex-1">
                  <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                    {selectedBrand.toLowerCase()} is composing
                    <span className="ml-1 inline-flex gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-ink-muted animate-pulse" />
                      <span className="w-1 h-1 rounded-full bg-ink-muted animate-pulse" style={{ animationDelay: '120ms' }} />
                      <span className="w-1 h-1 rounded-full bg-ink-muted animate-pulse" style={{ animationDelay: '240ms' }} />
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {messages.length === 0 && !isLoading && (
              <div className="text-center py-24">
                <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted mb-4">begin</div>
                <h2 className="font-serif italic text-[40px] leading-[1.1] tracking-[-0.01em] text-ink max-w-[520px] mx-auto">
                  Ask, draft, or paste a passage to refine.
                </h2>
                <p className="font-sans text-[14px] text-ink-soft mt-4">
                  Press <span className="font-mono text-[12px] text-ink">⌘K</span> to jump · <span className="font-mono text-[12px] text-ink">⌘.</span> to configure
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ============================================================== */}
      {/* Composer                                                        */}
      {/* ============================================================== */}
      <div className="absolute inset-x-0 bottom-0 p-6 pointer-events-none z-30">
        <div className="max-w-[820px] mx-auto pointer-events-auto">
          <div className="bg-surface border border-hairline rounded-composer overflow-hidden">
            {/* AI type tabs — keep existing routing behaviour */}
            <div className="flex border-b border-hairline-soft">
              {(['text', 'image', 'video', 'audio'] as AIType[]).map(type => (
                <button
                  key={type}
                  onClick={() => handleAITypeChange(type)}
                  className={`flex-1 h-10 inline-flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors ${
                    activeAIType === type
                      ? 'text-ink bg-bg'
                      : 'text-ink-muted hover:text-ink'
                  } ${type !== 'audio' ? 'border-r border-hairline-soft' : ''}`}
                >
                  {type === 'text' && <DotIcon active={activeAIType === type} />}
                  {type !== 'text' && <span aria-hidden className="opacity-60">·</span>}
                  <span>{type}</span>
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmitWithChat}>
              <textarea
                value={input}
                onChange={handleInputChange}
                placeholder="A line. A draft. A question. Anything."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    const formEvent = new Event('submit', { cancelable: true }) as unknown as React.FormEvent<HTMLFormElement>
                    handleSubmitWithChat(formEvent)
                  }
                }}
                className="w-full min-h-[88px] max-h-[240px] px-5 pt-4 pb-2 bg-transparent text-[15px] leading-[1.55] text-ink placeholder:text-ink-muted outline-none resize-none"
              />

              {/* Chip cluster — mode / model / tools / attach */}
              <div className="flex items-center gap-2 px-4 pb-3 pt-1 flex-wrap">
                <Chip>chat</Chip>
                <Chip>{(selectedModel.version || selectedModel.name).toLowerCase()}</Chip>
                <Chip>tools 0</Chip>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-sharp font-mono text-[10px] tracking-[0.04em] uppercase text-ink-muted hover:text-ink transition-colors"
                  title="Attach"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
                    <path d="M7.5 2.5l-4 4a1.5 1.5 0 002.12 2.12L9.6 4.6a3 3 0 00-4.24-4.24L1.4 4.36" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                  </svg>
                  attach
                </button>

                <span className="ml-auto font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                  ↵ send · ⇧↵ newline · / palette
                </span>
                <button
                  type="submit"
                  disabled={isLoading || !input?.trim()}
                  className="inline-flex items-center gap-1.5 h-7 px-3 bg-ink text-bg font-mono text-[10px] tracking-[0.18em] uppercase disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink-soft transition-colors"
                >
                  send
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden>
                    <path d="M1.5 4.5h6m0 0L5 2m2.5 2.5L5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center h-7 px-2.5 border border-hairline-soft rounded-sharp font-mono text-[10px] tracking-[0.04em] uppercase text-ink-soft">
      {children}
    </span>
  )
}

function DotIcon({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block w-1.5 h-1.5 rounded-full ${active ? 'bg-accent' : 'bg-ink-muted'}`}
    />
  )
}
