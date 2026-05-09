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
import { createClient } from '@/lib/supabase/client'
import {
  ensureActiveChat,
  getActiveChatId,
  listChats,
  setActiveChatId as persistActiveChatId,
  touchChat,
  type Chat,
} from '@/lib/chat-store'
import type { AppLanguage } from '@/shared/ui/chat/ChatWorkspace'

/* =====================================================================
   Modes — text route is "chat / research / code"; image, voice and video
   live on their own surfaces and selecting them swaps routes. The numbering
   matches the design reference (01..06).
   ===================================================================== */

const TEXT_MODES: ModeOption[] = [
  { id: 'chat',     label: 'Chat',     hint: 'plain conversation' },
  { id: 'research', label: 'Research', hint: 'web + citations' },
  { id: 'code',     label: 'Code',     hint: 'agent + tools' },
  { id: 'image',    label: 'Image',    hint: 'visual generation' },
  { id: 'voice',    label: 'Voice',    hint: 'spoken reply' },
  { id: 'video',    label: 'Video',    hint: 'motion + frames' },
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
  const { messages = [], input = '', handleInputChange, handleSubmit, isLoading = false, status, setMessages } = chat as any
  const isStreaming = Boolean(isLoading) || status === 'submitted' || status === 'streaming'
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
    { id: 'projects', label: 'Projects', icon: I.proj, onClick: () => router.push('/projects') },
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

  const cmdkGroups = useMemo(() => ([
    {
      label: 'jump to',
      items: [
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
    // handleNewChat is defined below in component scope and is stable for this surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]), [recentChats, router])

  function handleNewChat() {
    const c = ensureActiveChat('text', 'New thread', selectedModel.name)
    setActiveChatIdState(c.id)
    persistActiveChatId('text', c.id)
    setMessages?.([])
  }

  function handleModeChange(id: string) {
    setModeId(id)
    if (id === 'image')      router.push('/image')
    else if (id === 'voice') router.push('/audio')
    else if (id === 'video') router.push('/video')
    // 'chat' / 'research' / 'code' stay on /text
  }

  function handleThemeChange(next: PaletteKey) {
    setTheme(next)
    setStoredPalette(next)
  }

  /* ----- avatar dropdown actions ------------------------------------ */
  const [language, setLanguage] = useState<AppLanguage>('en')
  useEffect(() => {
    const stored = (typeof window !== 'undefined' && localStorage.getItem('clox.language')) as AppLanguage | null
    if (stored === 'en' || stored === 'ru') setLanguage(stored)
  }, [])

  function handleChangeLanguage(next: AppLanguage) {
    setLanguage(next)
    if (typeof window !== 'undefined') localStorage.setItem('clox.language', next)
  }

  async function handleSignOut() {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (e) {
      console.error('[v0] sign-out error:', e)
    }
    if (typeof window !== 'undefined') window.location.href = '/login'
  }

  async function handleDeleteAccount() {
    const ok = typeof window !== 'undefined'
      && window.confirm('Permanently delete your Clox account? This cannot be undone.')
    if (!ok) return
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      if (!res.ok) throw new Error(`delete failed: ${res.status}`)
    } catch (e) {
      console.error('[v0] delete-account error:', e)
      window.alert('We could not delete your account. Please contact support.')
      return
    }
    await handleSignOut()
  }

  /* ----- share -------------------------------------------------------- */
  async function handleShare() {
    const url = `${window.location.origin}/text?chat=${encodeURIComponent(activeChatId)}`
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: topTitle || 'Clox conversation',
          text: 'Conversation from Clox',
          url,
        })
        return
      }
    } catch { /* user-cancelled — fall through to clipboard */ }
    try {
      await navigator.clipboard.writeText(url)
      // Lightweight, non-blocking confirmation.
      const banner = document.createElement('div')
      banner.textContent = 'Link copied'
      banner.style.cssText = 'position:fixed;left:50%;bottom:32px;transform:translateX(-50%);background:#161410;color:#fbf7ee;font:12px/1 ui-monospace,monospace;letter-spacing:.08em;padding:10px 16px;border-radius:3px;z-index:9999;box-shadow:0 18px 56px rgba(0,0,0,.25)'
      document.body.appendChild(banner)
      setTimeout(() => banner.remove(), 1800)
    } catch (e) {
      console.error('[v0] share error:', e)
    }
  }

  /* ----- topstrip title --------------------------------------------- */
  const topTitle =
    messages.length > 0
      ? (messages[0]?.content || '').toString().split('\n')[0].slice(0, 64) || 'New thread'
      : 'New thread'

  const breadcrumb = `chats · ${selectedModel.brandName?.toLowerCase() ?? selectedModel.provider}`

  /* ----- user identity (live profile from Supabase) ----------------- */
  const [user, setUser] = useState<{ initial: string; name: string; plan: string; email?: string }>(
    { initial: '·', name: 'Signed out', plan: 'guest' },
  )
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser || cancelled) return

        const [profile, credits] = await Promise.all([
          supabase.from('profiles').select('first_name, last_name, plan').eq('id', authUser.id).single(),
          supabase.from('credits').select('balance_usd').eq('user_id', authUser.id).single(),
        ])
        if (cancelled) return

        const first = (profile.data?.first_name ?? '').trim()
        const last  = (profile.data?.last_name  ?? '').trim()
        const fallback = authUser.email?.split('@')[0] ?? 'Clox user'
        const fullName = [first, last].filter(Boolean).join(' ').trim() || fallback
        const initial = (first || fallback).slice(0, 1).toLowerCase() || '·'

        const planRaw = (profile.data?.plan as string | null | undefined)?.toLowerCase()
        let plan: string
        if (planRaw && planRaw !== 'free') plan = planRaw
        else if (credits.data?.balance_usd != null) {
          plan = `free · $${parseFloat(String(credits.data.balance_usd)).toFixed(2)}`
        } else plan = 'free'

        setUser({ initial, name: fullName, plan, email: authUser.email ?? undefined })
      } catch (e) {
        console.error('[v0] /text profile load failed', e)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="fixed inset-0 isolate">
      <ChatWorkspace
        theme={theme}
        variant="chip"
        brandName="Clox"
        brandVersion="0.5"
        user={user}
        onOpenSettings={() => router.push('/settings')}
        onChangeTheme={handleThemeChange}
        language={language}
        onChangeLanguage={handleChangeLanguage}
        onOpenSuperAdmin={() => router.push('/admin')}
        onOpenSkills={() => router.push('/skills')}
        onSignOut={handleSignOut}
        onDeleteAccount={handleDeleteAccount}
        nav={nav}
        recent={recent}
        onNewChat={handleNewChat}
        breadcrumb={breadcrumb}
        title={topTitle}
        onShare={handleShare}
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
        isStreaming={isStreaming}
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
