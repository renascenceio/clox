'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

import ChatWorkspace, {
  type ModeOption,
  type ModelOption,
  type RailNavItem,
  type TranscriptMessage,
} from '@/shared/ui/chat/ChatWorkspace'
import { I } from '@/shared/ui/chat/icons'
import {
  getStoredPalette,
  setStoredPalette,
  type PaletteKey,
} from '@/shared/ui/chat/palettes'

import { TEXT_MODELS } from '@/domains/text-generation/services/model-router'
import { useAvailableModels } from '@/lib/use-available-models'
import { getAdminSettings } from '@/lib/admin-settings'
import {
  ensureActiveChat,
  getActiveChatId,
  listChats,
  setActiveChatId as persistActiveChatId,
  touchChat,
  type Chat,
} from '@/lib/chat-store'

/* =====================================================================
   Modes — text route is "chat / research / code". Image / voice routes
   live elsewhere; selecting them swaps to those surfaces.
   ===================================================================== */

const TEXT_MODES: ModeOption[] = [
  { id: 'chat', label: 'Chat', hint: 'plain conversation' },
  { id: 'research', label: 'Research', hint: 'web + citations' },
  { id: 'code', label: 'Code', hint: 'agent + tools' },
  { id: 'image', label: 'Image', hint: 'visual generation' },
  { id: 'voice', label: 'Voice', hint: 'spoken reply' },
]

function modelTagFor(provider: string, brandName?: string): string {
  if (brandName) return brandName.toLowerCase()
  return provider
}

function shortName(version: string | undefined, name: string): string {
  return (version || name).toLowerCase()
}

function timestamp(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

/* =====================================================================
   Page
   ===================================================================== */

export default function TextPage() {
  const router = useRouter()
  const enabledModels = useAvailableModels(TEXT_MODELS)

  /* ----- theme ------------------------------------------------------- */
  const [theme, setTheme] = useState<PaletteKey>('pearl')
  useEffect(() => {
    const stored = getStoredPalette('pearl')
    setTheme(stored)
    document.documentElement.dataset.palette = stored
  }, [])

  /* ----- model + mode + active chat --------------------------------- */
  const [selectedModel, setSelectedModel] = useState<typeof TEXT_MODELS[number]>(TEXT_MODELS[0])
  const [modeId, setModeId] = useState<string>('chat')

  const [activeChatId, setActiveChatIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default-chat'
    return (
      getActiveChatId('text') ||
      localStorage.getItem('activeChatId') ||
      'default-chat'
    )
  })

  // Recent chats — refreshed when the chat store mutates.
  const [recentChats, setRecentChats] = useState<Chat[]>([])
  useEffect(() => {
    function refresh() {
      setRecentChats(
        listChats()
          .filter(c => (c.modality ?? 'text') === 'text')
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 8)
      )
    }
    refresh()
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [activeChatId])

  /* ----- per-chat config (system prompt, params) -------------------- */
  const [systemPrompt, setSystemPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2048)

  // Load chat-specific settings when activeChatId changes.
  useEffect(() => {
    const saved = localStorage.getItem(`chat-settings-${activeChatId}`)
    if (!saved) return
    try {
      const settings = JSON.parse(saved) as {
        modelId?: string
        systemPrompt?: string
        temperature?: number
        maxTokens?: number
      }
      if (settings.modelId) {
        const model = TEXT_MODELS.find(m => m.id === settings.modelId)
        if (model) setSelectedModel(model)
      }
      if (settings.systemPrompt !== undefined) setSystemPrompt(settings.systemPrompt)
      if (settings.temperature !== undefined) setTemperature(settings.temperature)
      if (settings.maxTokens !== undefined) setMaxTokens(settings.maxTokens)
    } catch (e) {
      console.error('[v0] failed to load chat settings:', e)
    }
  }, [activeChatId])

  // Persist settings whenever they change.
  useEffect(() => {
    const settings = { modelId: selectedModel.id, systemPrompt, temperature, maxTokens }
    localStorage.setItem(`chat-settings-${activeChatId}`, JSON.stringify(settings))
  }, [activeChatId, selectedModel.id, systemPrompt, temperature, maxTokens])

  // Keep selected model valid against the available list.
  useEffect(() => {
    if (enabledModels.length === 0) return
    const current = enabledModels.find(m => m.id === selectedModel.id)
    if (!current) setSelectedModel(enabledModels[0])
  }, [enabledModels, selectedModel.id])

  /* ----- chat hook -------------------------------------------------- */
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
    onError: error => console.error('[v0] chat api error:', error),
  })

  // Cast through `any` because @ai-sdk/react types differ across versions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages = [], input = '', handleInputChange, handleSubmit, isLoading = false, setMessages } = chat as any
  const setInput = (v: string) => {
    handleInputChange?.({ target: { value: v } } as unknown as React.ChangeEvent<HTMLTextAreaElement>)
  }

  // Persist & rehydrate chat history per active chat id.
  useEffect(() => {
    if (chat.messages && chat.messages.length > 0) {
      localStorage.setItem(`chat-history-${activeChatId}`, JSON.stringify(chat.messages))
    }
  }, [chat.messages, activeChatId])

  useEffect(() => {
    const saved = localStorage.getItem(`chat-history-${activeChatId}`)
    if (saved && setMessages) {
      try { setMessages(JSON.parse(saved)) } catch { setMessages([]) }
    } else if (setMessages) {
      setMessages([])
    }
  }, [activeChatId, setMessages])

  /* ----- send ------------------------------------------------------- */
  function handleSend() {
    const promptText = (input || '').trim()
    if (!promptText) return
    const c = ensureActiveChat('text', promptText, selectedModel.name)
    if (c.id !== activeChatId) {
      setActiveChatIdState(c.id)
      persistActiveChatId('text', c.id)
    } else {
      touchChat(c.id, { model: selectedModel.name })
    }
    handleSubmit?.(new Event('submit') as unknown as React.FormEvent<HTMLFormElement>)
  }

  /* ----- compose props for ChatWorkspace ---------------------------- */

  const models: ModelOption[] = useMemo(
    () => enabledModels.map(m => ({
      id: m.id,
      label: `${m.brandName ?? m.provider} ${m.version || m.name}`,
      tag: modelTagFor(m.provider, m.brandName),
      short: shortName(m.version, m.name),
    })),
    [enabledModels],
  )

  const transcript: TranscriptMessage[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (messages as any[]).map((m, i) => {
      const created: number = m.createdAt ? new Date(m.createdAt).getTime() : Date.now()
      const time = timestamp(created)
      if (m.role === 'user') {
        return {
          id: m.id ?? `u-${i}`,
          who: 'you' as const,
          time,
          body: <span style={{ whiteSpace: 'pre-wrap' }}>{String(m.content ?? '')}</span>,
        }
      }
      return {
        id: m.id ?? `a-${i}`,
        who: 'ai' as const,
        time,
        model: shortName(selectedModel.version, selectedModel.name),
        body: (
          <div className="prose prose-sm max-w-none prose-p:my-2 prose-p:leading-[1.6]">
            <ReactMarkdown>{String(m.content ?? '')}</ReactMarkdown>
          </div>
        ),
      }
    })
  }, [messages, selectedModel.version, selectedModel.name])

  const nav: RailNavItem[] = [
    { id: 'home', label: 'Home', icon: I.home, onClick: () => router.push('/') },
    { id: 'projects', label: 'Projects', icon: I.proj, count: 0 },
    { id: 'chats', label: 'Chats', icon: I.chats, count: recentChats.length, active: true },
    { id: 'history', label: 'History', icon: I.hist, onClick: () => router.push('/history') },
    { id: 'gallery', label: 'Gallery', icon: I.gal, onClick: () => router.push('/gallery') },
  ]

  const recent = recentChats.map(c => ({
    id: c.id,
    title: c.title,
    meta: `${timestamp(c.createdAt)} · ${c.model.toLowerCase()}`,
    active: c.id === activeChatId,
    onClick: () => {
      setActiveChatIdState(c.id)
      persistActiveChatId('text', c.id)
    },
  }))

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cmdkGroups = useMemo(() => ([
    {
      label: 'jump to',
      items: [
        { icon: I.home, label: 'Home', hint: 'g h', onSelect: () => router.push('/') },
        { icon: I.proj, label: 'Projects', hint: 'g p', onSelect: () => router.push('/projects') },
        { icon: I.chats, label: 'Chats', hint: 'g c', onSelect: () => router.push('/text') },
        { icon: I.hist, label: 'History', hint: 'g y', onSelect: () => router.push('/history') },
        { icon: I.gal, label: 'Gallery', hint: 'g g', onSelect: () => router.push('/gallery') },
      ],
    },
    {
      label: 'recent chats',
      items: recentChats.slice(0, 5).map(c => ({
        label: c.title,
        hint: timestamp(c.createdAt),
        onSelect: () => {
          setActiveChatIdState(c.id)
          persistActiveChatId('text', c.id)
        },
      })),
    },
    {
      label: 'actions',
      items: [
        { label: 'New chat', hint: '⌘N', onSelect: handleNewChat },
        { label: 'Switch model…', hint: '/' },
        { label: 'Open settings', hint: '⌘,', onSelect: () => router.push('/admin') },
      ],
    },
  ]), [recentChats, router])

  function handleNewChat() {
    const c = ensureActiveChat('text', 'New thread', selectedModel.name)
    setActiveChatIdState(c.id)
    persistActiveChatId('text', c.id)
    setMessages?.([])
  }

  function handleModeChange(id: string) {
    setModeId(id)
    if (id === 'image') router.push('/image')
    else if (id === 'voice') router.push('/audio')
    // 'chat' / 'research' / 'code' all stay on /text
  }

  function handleThemeChange(next: PaletteKey) {
    setTheme(next)
    setStoredPalette(next)
  }

  /* ----- topstrip title --------------------------------------------- */
  const topTitle =
    messages.length > 0
      ? (messages[0]?.content || '').toString().split('\n')[0].slice(0, 64) || 'New thread'
      : 'New thread'

  const breadcrumb = `chats · ${selectedModel.brandName?.toLowerCase() ?? selectedModel.provider}`

  /* ----- user identity --------------------------------------------- */
  const user = { initial: 'e', name: 'Elena Marchetti', plan: 'pro · 4 seats' }

  return (
    <div className="fixed inset-0 isolate">
      <ChatWorkspace
        theme={theme}
        variant="chip"
        brandName="Clox"
        brandVersion="0.5"
        user={user}
        onOpenSettings={() => router.push('/admin')}
        onChangeTheme={handleThemeChange}
        nav={nav}
        recent={recent}
        onNewChat={handleNewChat}
        breadcrumb={breadcrumb}
        title={topTitle}
        models={models}
        modelId={selectedModel.id}
        onChangeModel={(id) => {
          const m = enabledModels.find(x => x.id === id)
          if (m) {
            setSelectedModel(m)
            localStorage.setItem('selectedTextModelId', id)
          }
        }}
        modes={TEXT_MODES}
        modeId={modeId}
        onChangeMode={handleModeChange}
        transcript={transcript}
        isStreaming={isLoading}
        inputValue={input}
        onInputChange={setInput}
        onSend={handleSend}
        toolsCount={0}
        cmdkGroups={cmdkGroups}
        systemPrompt={systemPrompt}
        onChangeSystemPrompt={setSystemPrompt}
        temperature={temperature}
        onChangeTemperature={setTemperature}
        topP={0.95}
        maxTokens={maxTokens}
        onChangeMaxTokens={setMaxTokens}
      />
    </div>
  )
}
