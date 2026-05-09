'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

import ChatWorkspace, {
  type Attachment,
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
import { IMAGE_MODELS } from '@/domains/image-generation/services/image-models'
import { VIDEO_MODELS } from '@/domains/video-generation/services/video-models'
import { AUDIO_MODELS } from '@/domains/audio-generation/services/audio-models'
import { getCapability, type Capability } from '@/lib/ai-capabilities'
import { useAvailableModels } from '@/lib/use-available-models'
import { getAdminSettings, getProviderApiKey } from '@/lib/admin-settings'
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
  const enabledTextModels  = useAvailableModels(TEXT_MODELS)
  const enabledImageModels = useAvailableModels(IMAGE_MODELS)
  const enabledVideoModels = useAvailableModels(VIDEO_MODELS)
  const enabledAudioModels = useAvailableModels(AUDIO_MODELS)

  /* ----- theme ------------------------------------------------------- */
  const [theme, setTheme] = useState<PaletteKey>('pearl')
  useEffect(() => {
    const stored = getStoredPalette('pearl')
    setTheme(stored)
    document.documentElement.dataset.palette = stored
  }, [])

  /* ----- modality + model + active chat ----------------------------
     The /text surface is the single shell for every modality. `modeId`
     drives which model registry is active, which generation endpoint
     `handleSend` hits, and which capability spec the ConfigDrawer reads
     from. The legacy /image, /audio, /video routes are now thin
     server-side redirects that forward here with `?mode=…` set, so a
     direct bookmark or deeplink lands in the right composer instead of
     the deprecated standalone surfaces. */
  // Read the initial modality from the URL once on mount. We use raw
  // `window.location.search` rather than `useSearchParams` so we don't need
  // a Suspense boundary around the page (a requirement Next imposes on
  // pages that subscribe to search params during static generation).
  const [modeId, setModeId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'chat'
    const m = new URLSearchParams(window.location.search).get('mode')
    return m === 'image' || m === 'video' || m === 'voice' || m === 'chat' ? m : 'chat'
  })
  const modality: 'text' | 'image' | 'video' | 'audio' =
    modeId === 'image' ? 'image' :
    modeId === 'video' ? 'video' :
    modeId === 'voice' ? 'audio' : 'text'

  // The active model swaps as soon as the modality changes. We keep one
  // selected model per modality so flipping back and forth doesn't lose
  // your choice.
  const [selectedTextModel, setSelectedTextModel]   = useState<typeof TEXT_MODELS[number]>(TEXT_MODELS[0])
  const [selectedImageModel, setSelectedImageModel] = useState<typeof IMAGE_MODELS[number]>(IMAGE_MODELS[0])
  const [selectedVideoModel, setSelectedVideoModel] = useState<typeof VIDEO_MODELS[number]>(VIDEO_MODELS[0])
  const [selectedAudioModel, setSelectedAudioModel] = useState<typeof AUDIO_MODELS[number]>(AUDIO_MODELS[0])

  // Fan-out helpers — components only know about one "selectedModel" at a
  // time and one "registry" of options to choose from.
  const selectedModel =
    modality === 'image' ? selectedImageModel :
    modality === 'video' ? selectedVideoModel :
    modality === 'audio' ? selectedAudioModel : selectedTextModel

  const [activeChatId, setActiveChatIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default-chat'
    return (
      getActiveChatId('text') ||
      localStorage.getItem('activeChatId') ||
      'default-chat'
    )
  })

  // Recent chats — refreshed when the chat store mutates. Scoped to the
  // active modality so flipping into "image" surfaces image threads, etc.
  const [recentChats, setRecentChats] = useState<Chat[]>([])
  useEffect(() => {
    function refresh() {
      setRecentChats(
        listChats()
          .filter(c => (c.modality ?? 'text') === modality)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 8)
      )
    }
    refresh()
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [activeChatId, modality])

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
        if (model) setSelectedTextModel(model)
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

  // Keep the per-modality selection valid against what the admin has
  // enabled. Each modality has its own registry, so we run four guards.
  useEffect(() => {
    if (enabledTextModels.length === 0) return
    if (!enabledTextModels.find(m => m.id === selectedTextModel.id)) setSelectedTextModel(enabledTextModels[0])
  }, [enabledTextModels, selectedTextModel.id])
  useEffect(() => {
    if (enabledImageModels.length === 0) return
    if (!enabledImageModels.find(m => m.id === selectedImageModel.id)) setSelectedImageModel(enabledImageModels[0])
  }, [enabledImageModels, selectedImageModel.id])
  useEffect(() => {
    if (enabledVideoModels.length === 0) return
    if (!enabledVideoModels.find(m => m.id === selectedVideoModel.id)) setSelectedVideoModel(enabledVideoModels[0])
  }, [enabledVideoModels, selectedVideoModel.id])
  useEffect(() => {
    if (enabledAudioModels.length === 0) return
    if (!enabledAudioModels.find(m => m.id === selectedAudioModel.id)) setSelectedAudioModel(enabledAudioModels[0])
  }, [enabledAudioModels, selectedAudioModel.id])

  /* ----- chat hook (text-only path) --------------------------------
     The hook only fires when modality === 'text'. Image/audio/video are
     sent through dedicated REST calls below; we still drive their results
     into the same transcript so the surface stays unified. */
  const [currentApiKey, setCurrentApiKey] = useState('')
  useEffect(() => {
    const settings = getAdminSettings()
    const key = settings.providers[selectedTextModel.provider]?.apiKey || ''
    setCurrentApiKey(key)
  }, [selectedTextModel.provider])

  const chat = useChat({
    id: activeChatId,
    api: '/api/chat',
    body: {
      model: selectedTextModel.id,
      provider: selectedTextModel.provider,
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

  /* ----- attachments ------------------------------------------------- */
  // The page owns the attachment list; ChatWorkspace just renders it. We
  // serialise files to data URLs so they survive re-renders cleanly and can
  // be passed straight to useChat's `experimental_attachments`.
  const [attachments, setAttachments] = useState<Attachment[]>([])

  // Hard cap so a stray drag of a 50 MB PSD doesn't kill the request body.
  const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024 // 8 MB per file

  async function handleAttach(files: FileList) {
    const next: Attachment[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        console.warn('[v0] attachment too large, skipping:', file.name, file.size)
        window.alert(`"${file.name}" is too large (max 8 MB).`)
        continue
      }
      try {
        const dataUrl = await fileToDataUrl(file)
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl,
        })
      } catch (err) {
        console.error('[v0] failed to read attachment:', file.name, err)
      }
    }
    if (next.length > 0) setAttachments(curr => [...curr, ...next])
  }

  function handleRemoveAttachment(id: string) {
    setAttachments(curr => curr.filter(a => a.id !== id))
  }

  /* ----- per-modality params ---------------------------------------
     One bag per modality so flipping back and forth keeps the user's
     knobs intact. The ConfigDrawer reads from / writes to the slot that
     matches the current modality. */
  const [textParams,  setTextParams]  = useState<Record<string, unknown>>({})
  const [imageParams, setImageParams] = useState<Record<string, unknown>>({})
  const [videoParams, setVideoParams] = useState<Record<string, unknown>>({})
  const [audioParams, setAudioParams] = useState<Record<string, unknown>>({})

  const activeParams =
    modality === 'image' ? imageParams :
    modality === 'video' ? videoParams :
    modality === 'audio' ? audioParams : textParams

  function handleChangeParam(key: string, value: unknown) {
    const setter =
      modality === 'image' ? setImageParams :
      modality === 'video' ? setVideoParams :
      modality === 'audio' ? setAudioParams : setTextParams
    setter(prev => ({ ...prev, [key]: value }))
    // Mirror the legacy slots for the text path so existing useChat body
    // picks up the new values without a wider refactor.
    if (modality === 'text') {
      if (key === 'temperature') setTemperature(Number(value))
      if (key === 'maxTokens')   setMaxTokens(Number(value))
    }
  }

  /* ----- send ------------------------------------------------------- */
  // The single send entry point. Dispatches to /api/chat for text and to
  // the appropriate /api/generate-* endpoint for image/video/audio. Media
  // results are appended to the same transcript via setMessages so the UI
  // surface stays unified.
  async function handleSend() {
    const promptText = (input || '').trim()
    if (!promptText && attachments.length === 0) return

    const c = ensureActiveChat(modality, promptText || '(attachment)', selectedModel.name)
    if (c.id !== activeChatId) {
      setActiveChatIdState(c.id)
      persistActiveChatId(modality, c.id)
    } else {
      touchChat(c.id, { model: selectedModel.name })
    }

    if (modality === 'text') {
      const expAttachments = attachments.length > 0
        ? attachments.map(a => ({ name: a.name, contentType: a.contentType, url: a.dataUrl }))
        : undefined
      handleSubmit?.(
        new Event('submit') as unknown as React.FormEvent<HTMLFormElement>,
        expAttachments ? { experimental_attachments: expAttachments } : undefined,
      )
      setAttachments([])
      return
    }

    // ---- media path -----------------------------------------------
    // Append a user message and a placeholder assistant message; we'll
    // patch the assistant placeholder when the result arrives.
    const userId = `u-${Date.now()}`
    const aiId   = `a-${Date.now()}`
    setMessages?.((prev: unknown[]) => [
      ...(prev as unknown[]),
      { id: userId, role: 'user',      content: promptText, createdAt: new Date() },
      { id: aiId,   role: 'assistant', content: '', createdAt: new Date(),
        // Custom slot the transcript renderer below recognises.
        clox_pending: true, clox_modality: modality },
    ])
    setInput('')

    try {
      const apiKey = getProviderApiKey(selectedModel.provider) || undefined
      let result: { url?: string; durationSec?: number; error?: string } = {}
      if (modality === 'image') {
        const ratio = (imageParams.aspectRatio as string | undefined) ?? '1:1'
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText, model: selectedImageModel.id, ratio, apiKey }),
        })
        result = await res.json()
        if (!res.ok || !result.url) throw new Error(result.error || `Image generation failed (${res.status})`)
      } else if (modality === 'video') {
        const aspect   = (videoParams.aspectRatio as string | undefined) ?? '16:9'
        const duration = (videoParams.duration as number | undefined) ?? 5
        const res = await fetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText, model: selectedVideoModel.id, aspectRatio: aspect, duration, apiKey }),
        })
        result = await res.json()
        if (!res.ok || !result.url) throw new Error(result.error || `Video generation failed (${res.status})`)
      } else if (modality === 'audio') {
        const voice = audioParams.voice as string | undefined
        const res = await fetch('/api/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText, model: selectedAudioModel.id, voice, apiKey }),
        })
        result = await res.json()
        if (!res.ok || !result.url) throw new Error(result.error || `Audio generation failed (${res.status})`)
      }

      setMessages?.((prev: unknown[]) =>
        (prev as Array<Record<string, unknown>>).map(m =>
          m.id === aiId
            ? {
                ...m,
                content: '',
                clox_pending: false,
                clox_media_url: result.url,
                clox_media_kind: modality,
                clox_media_duration: result.durationSec,
              }
            : m,
        ),
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Generation failed'
      setMessages?.((prev: unknown[]) =>
        (prev as Array<Record<string, unknown>>).map(m =>
          m.id === aiId ? { ...m, content: msg, clox_pending: false, clox_error: true } : m,
        ),
      )
    }
  }

  /* ----- compose props for ChatWorkspace ---------------------------- */

  // The model dropdown surfaces only the registry that matches the
  // current modality, so users can't pick an image model in text mode.
  const activeRegistry =
    modality === 'image' ? enabledImageModels :
    modality === 'video' ? enabledVideoModels :
    modality === 'audio' ? enabledAudioModels : enabledTextModels

  const models: ModelOption[] = useMemo(
    () => activeRegistry.map(m => ({
      id: m.id,
      label: `${m.brandName ?? m.provider} ${m.version || m.name}`,
      tag: modelTagFor(m.provider, m.brandName),
      short: shortName(m.version, m.name),
    })),
    [activeRegistry],
  )

  // Capability descriptor for the active model — drives the ConfigDrawer.
  const capability: Capability | undefined = useMemo(
    () => getCapability(selectedModel.id, modality),
    [selectedModel.id, modality],
  )

  const transcript: TranscriptMessage[] = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (messages as any[]).map((m, i) => {
      const created: number = m.createdAt ? new Date(m.createdAt).getTime() : Date.now()
      const time = timestamp(created)
      if (m.role === 'user') {
        // useChat stores attachments on the message under `experimental_attachments`.
        // Render any image attachments inline above the text so the user can
        // see what they sent.
        const msgAttachments: Array<{ name?: string; contentType?: string; url?: string }> =
          Array.isArray(m.experimental_attachments) ? m.experimental_attachments : []
        const text = String(m.content ?? '')
        return {
          id: m.id ?? `u-${i}`,
          who: 'you' as const,
          time,
          body: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {msgAttachments.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {msgAttachments.map((a, ai) => {
                    const isImg = (a.contentType ?? '').startsWith('image/')
                    if (isImg && a.url) {
                      // eslint-disable-next-line @next/next/no-img-element
                      return (
                        <img
                          key={`${m.id ?? i}-att-${ai}`}
                          src={a.url}
                          alt={a.name ?? 'attachment'}
                          style={{
                            maxWidth: 220, maxHeight: 220, borderRadius: 2,
                            display: 'block', objectFit: 'cover',
                          }}
                        />
                      )
                    }
                    return (
                      <span
                        key={`${m.id ?? i}-att-${ai}`}
                        style={{
                          padding: '4px 8px',
                          background: 'rgba(255,255,255,0.12)',
                          borderRadius: 2,
                          fontSize: 11,
                        }}
                      >
                        {a.name ?? 'attachment'}
                      </span>
                    )
                  })}
                </div>
              )}
              {text && <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>}
            </div>
          ),
        }
      }
      // Image / video / audio results are surfaced as assistant messages
      // tagged with `clox_media_*`. Render them inline so the transcript
      // is one consistent timeline regardless of modality.
      const pending  = Boolean(m.clox_pending)
      const errored  = Boolean(m.clox_error)
      const mediaKind = m.clox_media_kind as 'image' | 'video' | 'audio' | undefined
      const mediaUrl  = m.clox_media_url  as string | undefined
      let body: React.ReactNode
      if (pending) {
        body = (
          <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
            generating {String(m.clox_modality ?? '')}…
          </span>
        )
      } else if (errored) {
        body = (
          <span style={{ color: 'var(--accent, #b00020)', fontStyle: 'italic' }}>
            {String(m.content ?? 'Generation failed')}
          </span>
        )
      } else if (mediaKind === 'image' && mediaUrl) {
        body = (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl} alt="generated" style={{ maxWidth: 360, borderRadius: 2, display: 'block' }} />
        )
      } else if (mediaKind === 'video' && mediaUrl) {
        body = (
          <video src={mediaUrl} controls style={{ maxWidth: 360, borderRadius: 2, display: 'block' }} />
        )
      } else if (mediaKind === 'audio' && mediaUrl) {
        body = <audio src={mediaUrl} controls style={{ width: 320 }} />
      } else {
        body = (
          <div className="prose prose-sm max-w-none prose-p:my-2 prose-p:leading-[1.6]">
            <ReactMarkdown>{String(m.content ?? '')}</ReactMarkdown>
          </div>
        )
      }

      return {
        id: m.id ?? `a-${i}`,
        who: 'ai' as const,
        time,
        model: shortName(selectedModel.version, selectedModel.name),
        body,
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
      persistActiveChatId(modality, c.id)
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
    const c = ensureActiveChat(modality, 'New thread', selectedModel.name)
    setActiveChatIdState(c.id)
    persistActiveChatId(modality, c.id)
    setMessages?.([])
  }

  function handleModeChange(id: string) {
    // All modalities live on /text. Switching mode only swaps the active
    // capability + send handler; the surface stays put. The dedicated
    // /image, /audio, /video routes remain for direct deep-links.
    setModeId(id)
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
          // Route the change into the right per-modality slot. Each
          // modality keeps its own selection so flipping between them
          // is sticky.
          if (modality === 'image') {
            const m = enabledImageModels.find(x => x.id === id)
            if (m) { setSelectedImageModel(m); localStorage.setItem('selectedImageModelId', id) }
          } else if (modality === 'video') {
            const m = enabledVideoModels.find(x => x.id === id)
            if (m) { setSelectedVideoModel(m); localStorage.setItem('selectedVideoModelId', id) }
          } else if (modality === 'audio') {
            const m = enabledAudioModels.find(x => x.id === id)
            if (m) { setSelectedAudioModel(m); localStorage.setItem('selectedAudioModelId', id) }
          } else {
            const m = enabledTextModels.find(x => x.id === id)
            if (m) { setSelectedTextModel(m); localStorage.setItem('selectedTextModelId', id) }
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
        attachments={attachments}
        onAttach={handleAttach}
        onRemoveAttachment={handleRemoveAttachment}
        toolsCount={0}
        cmdkGroups={cmdkGroups}
        systemPrompt={systemPrompt}
        onChangeSystemPrompt={setSystemPrompt}
        capability={capability}
        params={activeParams}
        onChangeParam={handleChangeParam}
        temperature={temperature}
        onChangeTemperature={setTemperature}
        topP={0.95}
        maxTokens={maxTokens}
        onChangeMaxTokens={setMaxTokens}
      />
    </div>
  )
}

/* =====================================================================
   Helpers
   ===================================================================== */

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}
