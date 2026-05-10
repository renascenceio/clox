'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { CodeArtifact } from '@/shared/ui/components/CodeArtifact'
import { DownloadStrip, type DownloadStripFile } from '@/shared/ui/components/DownloadStrip'

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
import {
  filterSkillsByModality,
  dbSkillsToOptions,
  buildSkillsBlock,
  buildSkillsPromptPrefix,
  resolveSkills,
  type SkillModality,
} from '@/lib/skills'
import { useUserSkills } from '@/lib/hooks/useUserSkills'
import { detectAutoSkills } from '@/lib/skills-auto-detect'
import { useAvailableModels } from '@/lib/use-available-models'
import { getAdminSettings, getProviderApiKey } from '@/lib/admin-settings'
import { createClient } from '@/lib/supabase/client'
import {
  createChat,
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
  // The Voice mode picker should only surface text-to-speech models —
  // not the music-generation entries (Suno, Udio, Stable Audio) that
  // also live in AUDIO_MODELS for a future "Music" mode. Without this
  // filter the dropdown was 15 rows long and the speech entries
  // (ElevenLabs, OpenAI TTS, Azure, Play.ht, Fish, ChatGLM) were
  // visually buried beneath the music half — users reported that
  // ElevenLabs "wasn't in the list" even though it was technically
  // present, just below the fold of the dropdown's vh-cap on small
  // viewports. Pre-filtering on `type === 'voice'` keeps the picker
  // focused on what the active mode can actually deliver.
  const VOICE_AUDIO_MODELS = useMemo(
    () => AUDIO_MODELS.filter(m => m.type === 'voice'),
    [],
  )
  const enabledAudioModels = useAvailableModels(VOICE_AUDIO_MODELS)

  /* ----- theme ------------------------------------------------------- */
  // Initial paint comes from the blocking script in `layout.tsx`, which
  // already applied `data-theme` + `.dark` synchronously. Here we just
  // mirror the value into React state so the inline-styled palette
  // regions (which read this `theme` variable) match what's already on
  // the html element. We deliberately do NOT touch the DOM attributes
  // here — those are owned by `setStoredPalette` to avoid double writes.
  const [theme, setTheme] = useState<PaletteKey>('pearl')
  useEffect(() => {
    const stored = getStoredPalette('pearl')
    setTheme(stored)
  }, [])

  /* ----- modality + model + active chat ----------------------------
     The /text surface is the single shell for every modality. `modeId`
     drives which model registry is active, which generation endpoint
     `handleSend` hits, and which capability spec the ConfigDrawer reads
     from. The legacy /image, /audio, /video routes are now thin
     server-side redirects that forward here with `?mode=…` set, so a
     direct bookmark or deeplink lands in the right composer instead of
     the deprecated standalone surfaces. */
  // Read the initial modality from the URL. We MUST start with the
  // server-rendered default ('chat') and only swap to the URL value after
  // mount — otherwise the SSR HTML and the first client render disagree on
  // every prop downstream of `modeId`, which trips React hydration errors
  // #418/#423/#425. The `useEffect` below performs the swap exactly once.
  const [modeId, setModeId] = useState<string>('chat')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const m = new URLSearchParams(window.location.search).get('mode')
    if (m === 'image' || m === 'video' || m === 'voice' || m === 'chat') {
      setModeId(m)
    }
  }, [])
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

  // Same SSR-safety story as `modeId`: start with a stable default that
  // matches the server render, then hydrate from localStorage after mount.
  // Reading localStorage in the initial state would produce a different
  // value on the first client render and trigger hydration mismatch errors.
  const [activeChatId, setActiveChatIdState] = useState<string>('default-chat')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const fromStore = getActiveChatId('text') || localStorage.getItem('activeChatId')
    if (fromStore && fromStore !== 'default-chat') setActiveChatIdState(fromStore)
  }, [])

  // Recent chats — refreshed when the chat store mutates. Scoped to the
  // active modality so flipping into "image" surfaces image threads, etc.
  //
  // Two events keep this in sync:
  //   • `storage`            — mutations from OTHER tabs (cross-tab sync)
  //   • `clox-chats-changed` — mutations from THIS tab (the chat-store
  //     dispatches this custom event after every saveChats() call).
  // Listening to only `storage` was the bug — it never fires in the same
  // tab that wrote the value, so creating a new chat would persist but
  // the sidebar wouldn't show it until a full reload.
  const [recentChats, setRecentChats] = useState<Chat[]>([])
  useEffect(() => {
    function refresh() {
      setRecentChats(
        listChats()
          .filter(c => (c.modality ?? 'text') === modality && !c.archived)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 8)
      )
    }
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('clox-chats-changed', refresh as EventListener)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('clox-chats-changed', refresh as EventListener)
    }
  }, [activeChatId, modality])

  /* ----- per-chat config (system prompt, params) -------------------- */
  const [systemPrompt, setSystemPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(2048)

  /* ----- skills ------------------------------------------------------
     One source of truth: every selectable skill is a row in
     `public.skills`, fetched via `useUserSkills()`. Modality is encoded
     on each row's `tags` array (`text`, `image`, `video`, `audio`), and
     `filterSkillsByModality` picks the relevant subset for the current
     mode. The 21 behavioural overlays that used to live in
     `lib/skills-registry.ts` were migrated into the table by
     `scripts/005_registry_overlays.sql`, so /skills, the chat composer,
     and every media-gen page now show identical lists.

     Text-mode selections persist via `useUserSkills.toggle()` (round-
     trips through Supabase). Media-mode selections (image/video/audio)
     stay in-memory because they're stylistic overlays for a one-shot
     prompt, not something users want to be sticky across sessions. */
  const dbSkills = useUserSkills()

  const [imageSkillIds, setImageSkillIds] = useState<string[]>([])
  const [videoSkillIds, setVideoSkillIds] = useState<string[]>([])
  const [audioSkillIds, setAudioSkillIds] = useState<string[]>([])

  const activeSkillIds =
    modality === 'image' ? imageSkillIds :
    modality === 'video' ? videoSkillIds :
    modality === 'audio' ? audioSkillIds :
    dbSkills.activeIds

  // The picker only offers skills declared for the active modality.
  // `filterSkillsByModality` reads each row's `tags` array — text mode
  // includes "tagged text" plus "untagged for any media", so the 46+
  // long-form curated skills (PDF Specialist, Frontend Designer, …)
  // keep showing up in chat without anyone having to backfill explicit
  // text tags on every row.
  const availableSkills = useMemo(() => {
    const filtered = filterSkillsByModality(dbSkills.skills, modality as SkillModality)
    return dbSkillsToOptions(filtered)
  }, [modality, dbSkills.skills])

  const handleToggleSkill = (id: string) => {
    if (modality === 'text') {
      // Text-mode skills round-trip through Supabase so changes show
      // up on the /skills page (and vice-versa).
      void dbSkills.toggle(id)
      // If the user manually flips an auto-detected skill ON, drop it
      // from the dismissal set so reverting (× then + again) stays
      // consistent.
      setDismissedAutoIds(prev => {
        if (!prev.has(id)) return prev
        const next = new Set(prev); next.delete(id); return next
      })
      return
    }
    // Media modes keep selections in component state — they're per-
    // prompt overlays, not user-curated catalogues.
    const current = activeSkillIds
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
    if (modality === 'image') setImageSkillIds(next)
    else if (modality === 'video') setVideoSkillIds(next)
    else if (modality === 'audio') setAudioSkillIds(next)
  }

  /* ----- per-turn auto-skill state -----------------------------------
     Auto-detected skills come from `detectAutoSkills(input, …)` and are
     ephemeral — they apply only to the current draft. We need two
     additions on top of that:
       • Dismissals so the user can suppress an auto-suggestion before
         sending (the "×" on a dashed pill in the ActiveSkillsBar).
       • A live id list the composer can render even before submit, so
         the user sees the semi-automatic boost their prompt is going
         to receive.
     The dismissal set is cleared after every successful submit so the
     next prompt re-runs detection from scratch. */
  const [dismissedAutoIds, setDismissedAutoIds] = useState<Set<string>>(new Set())

  function handleDismissAutoSkill(id: string) {
    setDismissedAutoIds(prev => {
      const next = new Set(prev); next.add(id); return next
    })
  }
  const handleClearSkills = () => {
    if (modality === 'text') {
      void dbSkills.clearAll()
      return
    }
    if (modality === 'image') setImageSkillIds([])
    else if (modality === 'video') setVideoSkillIds([])
    else if (modality === 'audio') setAudioSkillIds([])
  }

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

  // Keep the per-modality selection sensible against what's actually
  // configured. `useAvailableModels` now returns all models with a
  // `connected` flag, so we default to the first *connected* model
  // whenever the current pick is disconnected — that way users land
  // on a model that will work, while still being able to manually
  // pick a disconnected one and discover the "needs api key" hint.
  useEffect(() => {
    if (enabledTextModels.length === 0) return
    const current = enabledTextModels.find(m => m.id === selectedTextModel.id)
    if (current?.connected) return
    const firstConnected = enabledTextModels.find(m => m.connected)
    if (firstConnected) setSelectedTextModel(firstConnected)
  }, [enabledTextModels, selectedTextModel.id])
  useEffect(() => {
    if (enabledImageModels.length === 0) return
    const current = enabledImageModels.find(m => m.id === selectedImageModel.id)
    if (current?.connected) return
    const firstConnected = enabledImageModels.find(m => m.connected)
    if (firstConnected) setSelectedImageModel(firstConnected)
  }, [enabledImageModels, selectedImageModel.id])
  useEffect(() => {
    if (enabledVideoModels.length === 0) return
    const current = enabledVideoModels.find(m => m.id === selectedVideoModel.id)
    if (current?.connected) return
    const firstConnected = enabledVideoModels.find(m => m.connected)
    if (firstConnected) setSelectedVideoModel(firstConnected)
  }, [enabledVideoModels, selectedVideoModel.id])
  useEffect(() => {
    if (enabledAudioModels.length === 0) return
    const current = enabledAudioModels.find(m => m.id === selectedAudioModel.id)
    if (current?.connected) return
    const firstConnected = enabledAudioModels.find(m => m.connected)
    if (firstConnected) setSelectedAudioModel(firstConnected)
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

  // Append the active DB skills to the system prompt for every text
  // request. `buildSkillsBlock` concatenates each row's full
  // `system_prompt` under a `### Name` header, so multi-paragraph
  // prompts (Anthropic-style document specialists, the frontend-
  // designer brief, …) keep their structure. Short overlay prompts
  // (Concise, Step-by-step, JSON only) come through with the same
  // formatting — they're just shorter, no special-casing needed. */
  const composedSystemPrompt = useMemo(() => {
    const activeRows = resolveSkills(dbSkills.skills, dbSkills.activeIds)
    const skillsBlock = buildSkillsBlock(activeRows)
    return [systemPrompt.trim(), skillsBlock].filter(Boolean).join('\n\n')
  }, [systemPrompt, dbSkills.skills, dbSkills.activeIds])

  /* ----- per-message model byline ------------------------------------
     Each assistant message must show the model that *actually* produced
     it, not whatever is currently selected in the picker. We capture the
     active model label at submit-time into a FIFO ref, then pop it off
     when the matching `onFinish` fires and stamp it onto the message
     under a `clox_model` field. The custom field rides through the
     existing localStorage round-trip (we already serialise the whole
     message) so historic transcripts keep their correct byline across
     reloads. */
  const pendingModelRef = useRef<string[]>([])

  /* ----- tools state -------------------------------------------------
     Two real, model-callable tools the chat composer exposes through the
     slash menu. Both default to OFF so a vanilla chat behaves identically
     to before — the user has to opt in. Selection is persisted to
     localStorage so a refresh doesn't silently disarm what the user
     turned on. Declared HERE (above useChat) because the useChat body
     references `enabledToolIds` and JS hoisting only catches function
     declarations, not const/let.
     Slash-menu copy is "web search" / "code execute"; the API route
     speaks `web_search` / `run_javascript`. The mapping happens once,
     in `enabledToolIds`. */
  const [toolsState, setToolsState] = useState<{ label: string; on: boolean }[]>(() => {
    // Three real, model-callable tool toggles:
    //   "web search"     →  web_search       (Tavily — sub-second, free tier)
    //   "code execute"   →  run_javascript   (in-process Node vm, 1s timeout)
    //   "python sandbox" →  bash + python    (Vercel Sandbox microVM, full
    //                                         filesystem + Python 3.13 with
    //                                         the Anthropic skills bundle —
    //                                         the heavy-but-capable option)
    // The two sandbox tool ids ride on a single composer toggle because a
    // user enabling Python almost always wants `bash` for filesystem ops too,
    // and surfacing them as separate switches just adds a footgun.
    const TOOL_LABELS = ['web search', 'code execute', 'python sandbox'] as const
    if (typeof window === 'undefined') {
      return TOOL_LABELS.map(label => ({ label, on: false }))
    }
    try {
      const saved = JSON.parse(localStorage.getItem('clox:toolsState') ?? 'null')
      if (Array.isArray(saved)) {
        // Reconcile: keep any saved on-states for known labels; drop unknowns.
        return TOOL_LABELS.map(label => ({
          label,
          on: Boolean(saved.find((s: { label: string; on: boolean }) => s.label === label)?.on),
        }))
      }
    } catch { /* fall through to defaults */ }
    return TOOL_LABELS.map(label => ({ label, on: false }))
  })

  function handleToggleTool(label: string) {
    setToolsState(curr => {
      const next = curr.map(t => (t.label === label ? { ...t, on: !t.on } : t))
      try { localStorage.setItem('clox:toolsState', JSON.stringify(next)) } catch { /* quota */ }
      return next
    })
  }

  const enabledToolIds = useMemo(() => {
    const ids: string[] = []
    for (const t of toolsState) {
      if (!t.on) continue
      if (t.label === 'web search')     ids.push('web_search')
      if (t.label === 'code execute')   ids.push('run_javascript')
      // "python sandbox" arms BOTH server-side tool ids; the route binds
      // them to the same per-chat microVM and the model picks `bash` vs
      // `python` per call.
      if (t.label === 'python sandbox') ids.push('bash', 'python')
    }
    return ids
  }, [toolsState])

  const chat = useChat({
    id: activeChatId,
    api: '/api/chat',
    body: {
      model: selectedTextModel.id,
      provider: selectedTextModel.provider,
      systemPrompt: composedSystemPrompt,
      temperature,
      maxTokens,
      apiKey: currentApiKey,
      // Forward the user's enabled tools so /api/chat can attach the
      // matching tool definitions to streamText. Sending an empty list
      // is cheap and explicit; the route reads `tools: []` as "no
      // tools, behave like a plain chat" with zero overhead.
      tools: enabledToolIds,
    },
    onError: error => console.error('[v0] chat api error:', error),
    onFinish: (message: { id?: string }) => {
      // The label was pushed in handleSend right before handleSubmit, so
      // the head of the queue corresponds to this finishing message even
      // if the user has since changed model in the picker.
      const label = pendingModelRef.current.shift()
      if (!label || !message?.id) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(chat as any).setMessages?.((prev: Array<Record<string, unknown>>) =>
        prev.map(m => (m.id === message.id ? { ...m, clox_model: label } : m)),
      )
    },
  })

  // Cast through `any` because @ai-sdk/react types differ across versions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages = [], input = '', handleInputChange, handleSubmit, isLoading = false, status, setMessages } = chat as any
  const isStreaming = Boolean(isLoading) || status === 'submitted' || status === 'streaming'
  const setInput = (v: string) => {
    handleInputChange?.({ target: { value: v } } as unknown as React.ChangeEvent<HTMLTextAreaElement>)
  }

  /** Live auto-detection ids for the current draft, filtered by
   *  dismissals. Empty in non-text modalities and when the draft is empty.
   *
   *  Kept right next to the rest of the chat-state derivation so the
   *  composer always renders the bar based on what the user is *currently*
   *  typing — `detectAutoSkills` is cheap (regex over the catalogue's
   *  tags + a phrase map) so re-running on every keystroke is fine. */
  const autoDetectedSkillIds = useMemo(() => {
    if (modality !== 'text') return []
    if (!input?.trim()) return []
    const detected = detectAutoSkills(input, dbSkills.skills, dbSkills.activeIds)
    return detected
      .filter(s => !dismissedAutoIds.has(s.id))
      .map(s => s.id)
  }, [modality, input, dbSkills.skills, dbSkills.activeIds, dismissedAutoIds])

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
      // Snapshot the model the user is sending with so the message byline
      // sticks even if they change the picker before the response finishes.
      pendingModelRef.current.push(
        shortName(selectedTextModel.version, selectedTextModel.name),
      )

      // ── Auto-apply curated skills ───────────────────────────────────
      // Match the prompt against the catalogue's tags + a phrase map so
      // "make me a pdf report" picks up the PDF Document Specialist
      // without the user opening the picker. The matches ride along this
      // ONE submission only — nothing gets persisted to user_skills.
      // We pass them through `handleSubmit`'s per-submit `body` override
      // so the request gets the augmented systemPrompt without disturbing
      // the useChat options closure.
      // Drop any auto-suggestions the user explicitly dismissed via the
      // "×" on a dashed pill in the ActiveSkillsBar before this send. The
      // dismissal set is cleared at the end of this handler so the next
      // prompt re-runs detection from scratch.
      const autoSkills = detectAutoSkills(
        promptText,
        dbSkills.skills,
        dbSkills.activeIds,
      ).filter(s => !dismissedAutoIds.has(s.id))
      const autoBlock = buildSkillsBlock(autoSkills)
      const augmentedSystemPrompt = autoBlock
        ? `${composedSystemPrompt}\n\n${autoBlock}`
        : composedSystemPrompt

      const expAttachments = attachments.length > 0
        ? attachments.map(a => ({ name: a.name, contentType: a.contentType, url: a.dataUrl }))
        : undefined

      // Build the second-arg options. AI SDK 4's `ChatRequestOptions`
      // accepts a `body` override that is shallow-merged on top of the
      // useChat options.body for THIS submission — exactly the slot we
      // need for per-message system prompt augmentation.
      const submitOptions: Record<string, unknown> = {}
      if (expAttachments) submitOptions.experimental_attachments = expAttachments
      if (autoSkills.length > 0) {
        submitOptions.body = { systemPrompt: augmentedSystemPrompt }
      }

      handleSubmit?.(
        new Event('submit') as unknown as React.FormEvent<HTMLFormElement>,
        Object.keys(submitOptions).length > 0 ? submitOptions : undefined,
      )

      // Stamp the just-submitted user message so the transcript can
      // render "Applied: <skill names>" above it. handleSubmit appends
      // synchronously, so the latest user message in `messages` is the
      // one we just sent. We use a microtask so React has flushed the
      // append before we patch — otherwise setMessages would race the
      // pending update useChat just queued.
      if (autoSkills.length > 0 && setMessages) {
        const skillNames = autoSkills.map(s => s.name)
        queueMicrotask(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setMessages((prev: any[]) => {
            // Find the LAST user message without an existing stamp and
            // attach the names. Walking from the end is robust against
            // any message reorder useChat does internally.
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i]?.role === 'user' && !prev[i].clox_auto_skills) {
                const next = [...prev]
                next[i] = { ...next[i], clox_auto_skills: skillNames }
                return next
              }
            }
            return prev
          })
        })
      }

      setAttachments([])
      // Auto-skill dismissals are per-turn — reset for the next prompt
      // so a previously-suppressed skill can re-fire if the new draft
      // matches it again.
      if (dismissedAutoIds.size > 0) setDismissedAutoIds(new Set())
      return
    }

    // ---- media path -----------------------------------------------
    // Append a user message and a placeholder assistant message; we'll
    // patch the assistant placeholder when the result arrives. We stamp
    // the model label on the placeholder up front because the media
    // pipeline doesn't go through useChat / onFinish.
    const userId = `u-${Date.now()}`
    const aiId   = `a-${Date.now()}`
    const mediaModelLabel = shortName(selectedModel.version, selectedModel.name)
    setMessages?.((prev: unknown[]) => [
      ...(prev as unknown[]),
      { id: userId, role: 'user',      content: promptText, createdAt: new Date() },
      { id: aiId,   role: 'assistant', content: '', createdAt: new Date(),
        // Custom slot the transcript renderer below recognises.
        clox_pending: true, clox_modality: modality, clox_model: mediaModelLabel },
    ])
    setInput('')

    try {
      const apiKey = getProviderApiKey(selectedModel.provider) || undefined
      // Dual-credential providers (Kling, Baidu ERNIE, Play.ht, Azure
      // Speech…) round-trip a second value alongside the API key. We
      // read it straight off the admin-settings store so the existing
      // single-key callers don't need to know about it; routes that
      // don't care simply ignore the field.
      const apiSecret =
        getAdminSettings().providers[selectedModel.provider]?.apiSecret || undefined
      // Media-gen routes accept a single `prompt` string. We thread the
      // active skills through by prepending a tight directive built from
      // each skill's `system_prompt`. `resolveSkills` drops any unknown
      // ids (stale localStorage etc.) and `buildSkillsPromptPrefix`
      // returns '' when nothing is active, so the prompt is unchanged
      // when no skills are selected.
      const activeMediaRows = resolveSkills(dbSkills.skills, activeSkillIds)
      const skillsPrefix    = buildSkillsPromptPrefix(activeMediaRows)
      const composedPrompt  = skillsPrefix + promptText

      let result: { url?: string; urls?: string[]; durationSec?: number; error?: string } = {}
      if (modality === 'image') {
        const ratio = (imageParams.aspectRatio as string | undefined) ?? '1:1'
        // The image picker exposes a 1-4 count for every model. Pass it
        // through so the route can fan out parallel calls (DALL-E 3 only
        // accepts n=1 natively, so the server loops; other providers
        // honour `count` directly).
        const count = Math.max(1, Math.min(4, Number(imageParams.count) || 1))
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: composedPrompt, model: selectedImageModel.id, ratio, count, apiKey }),
        })
        result = await res.json()
        if (!res.ok || !result.url) throw new Error(result.error || `Image generation failed (${res.status})`)
      } else if (modality === 'video') {
        const aspect   = (videoParams.aspectRatio as string | undefined) ?? '16:9'
        const duration = (videoParams.duration as number | undefined) ?? 5
        const res = await fetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: composedPrompt, model: selectedVideoModel.id, aspectRatio: aspect, duration, apiKey, apiSecret }),
        })
        result = await res.json()
        if (!res.ok || !result.url) throw new Error(result.error || `Video generation failed (${res.status})`)
      } else if (modality === 'audio') {
        const voice = audioParams.voice as string | undefined
        const res = await fetch('/api/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: composedPrompt, model: selectedAudioModel.id, voice, apiKey }),
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
                // Capture the full set when the route returned multiple
                // images (image-only for now). Falls back to a single
                // entry so the renderer's grid path also works for
                // legacy single-image responses.
                clox_media_urls: result.urls ?? (result.url ? [result.url] : undefined),
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
    () => activeRegistry.map(m => {
      // `useAvailableModels` now returns every model with a `connected`
      // flag so the picker can show provider models the user hasn't
      // configured yet (e.g. Moonshot/Kling/Kimi) instead of hiding them
      // outright. Disconnected models swap their provider tag for a
      // "needs api key" affordance the menu renders in muted style.
      const connected = (m as typeof m & { connected?: boolean }).connected ?? true
      return {
        id: m.id,
        label: `${m.brandName ?? m.provider} ${m.version || m.name}`,
        tag: connected ? modelTagFor(m.provider, m.brandName) : 'needs api key',
        short: shortName(m.version, m.name),
        disconnected: !connected,
      }
    }),
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
        // `clox_auto_skills` is stamped by handleSend right after submit; it
        // surfaces the curated skills the prompt auto-triggered (e.g. "PDF
        // Document Specialist" for "make me a pdf report") so the user sees
        // exactly what extra craft guidance the model got. Empty / absent
        // means no auto-application happened — the badge stays hidden.
        const autoSkillNames: string[] = Array.isArray(m.clox_auto_skills)
          ? (m.clox_auto_skills as string[])
          : []
        return {
          id: m.id ?? `u-${i}`,
          who: 'you' as const,
          time,
          body: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {autoSkillNames.length > 0 && (
                // Skill badge — small mono pill matching the same
                // letter-spacing & casing the rest of the app uses for
                // metadata. Sits above the message body so it reads as
                // "context for the next bubble" rather than as part of
                // the user's words.
                <div
                  style={{
                    display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    fontSize: 10, letterSpacing: '0.08em',
                    opacity: 0.75,
                  }}
                >
                  <span style={{ textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                    Applied
                  </span>
                  {autoSkillNames.map((name, ai) => (
                    <span
                      key={ai}
                      style={{
                        padding: '2px 6px',
                        border: '1px solid currentColor',
                        borderRadius: 2,
                      }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
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
      // Multi-image responses (DALL-E count > 1, etc.) ride on
      // `clox_media_urls`. Fall back to the single-url path so legacy
      // messages still render.
      const mediaUrls = Array.isArray(m.clox_media_urls)
        ? (m.clox_media_urls as string[])
        : mediaUrl
          ? [mediaUrl]
          : []
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
      } else if (mediaKind === 'image' && mediaUrls.length > 0) {
        // 1 → full size; 2 → side by side; 3-4 → 2x2 grid. Each cell
        // caps so a 4-up doesn't blow out the chat column width.
        const cols = mediaUrls.length === 1 ? 1 : 2
        const cellMax = mediaUrls.length === 1 ? 360 : 220
        body = (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(0, ${cellMax}px))`,
            gap: 6,
          }}>
            {mediaUrls.map((u, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={u}
                alt={`generated ${idx + 1}`}
                style={{ width: '100%', borderRadius: 2, display: 'block' }}
              />
            ))}
          </div>
        )
      } else if (mediaKind === 'video' && mediaUrl) {
        body = (
          <video src={mediaUrl} controls style={{ maxWidth: 360, borderRadius: 2, display: 'block' }} />
        )
      } else if (mediaKind === 'audio' && mediaUrl) {
        body = <audio src={mediaUrl} controls style={{ width: 320 }} />
      } else {
        // Render assistant text as markdown, but route every fenced
        // code block through `CodeArtifact` so the user can copy /
        // download / preview anything the model generates (HTML pages,
        // CSVs, JSON payloads, scripts, …). Inline `<code>` (single-
        // backtick) is left alone — only display blocks become
        // artifacts.
        body = (
          <div className="prose prose-sm max-w-none prose-p:my-2 prose-p:leading-[1.6]">
            <ReactMarkdown
              components={{
                code: CodeArtifact,
                // Strip the default <pre> wrapper because CodeArtifact
                // ships its own framed container; nesting another
                // <pre> would double-pad and disable horizontal scroll.
                pre: ({ children }) => <>{children}</>,
              }}
            >
              {String(m.content ?? '')}
            </ReactMarkdown>
          </div>
        )
      }

      // Prefer the model label that was captured at the time this
      // message was generated. We only fall back to the live picker
      // for an in-flight assistant response that hasn't reached
      // `onFinish` yet (i.e. it never got `clox_model` stamped).
      const stampedModel = typeof m.clox_model === 'string' ? m.clox_model : undefined

      // ── Tool-invocation strip ──────────────────────────────────────
      // useChat surfaces tool calls on the assistant message under
      // `toolInvocations`. We render each one as a small status pill
      // ABOVE the message body so the user sees both the action the
      // model took ("Searching the web for: AI SDK 6 release date") and
      // a one-line preview of the result. Pills sit above the body
      // because they're context for the answer that follows; rendering
      // them below would feel like an after-thought.
      type ToolInvocation = {
        toolCallId?: string
        toolName?: string
        state?: 'partial-call' | 'call' | 'result'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        args?: any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result?: any
      }
      const toolInvocations: ToolInvocation[] = Array.isArray(m.toolInvocations)
        ? m.toolInvocations
        : []

      // Pull sandbox-output annotations off the message. The chat
      // route writes them via `dataStream.writeMessageAnnotation` from
      // inside `streamText.onFinish`, so they land on the assistant
      // message in `useChat`'s `messages` array as `annotations: any[]`.
      // We filter for our `output-file` shape and ignore anything else
      // — the array is forward-compatible with future annotation kinds.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const annotations = Array.isArray((m as any).annotations) ? (m as any).annotations : []
      const outputFiles: DownloadStripFile[] = annotations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((a: any) => a && a.type === 'output-file' && typeof a.url === 'string')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((a: any) => ({
          filename: String(a.filename ?? 'output'),
          url:      String(a.url),
          mime:     String(a.mime ?? 'application/octet-stream'),
          size:     typeof a.size === 'number' ? a.size : 0,
        }))

      let bodyWithTools: React.ReactNode = body
      if (toolInvocations.length > 0 || outputFiles.length > 0) {
        bodyWithTools = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {toolInvocations.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {toolInvocations.map((inv, ti) => {
                const name = String(inv.toolName ?? 'tool')
                const isRunning = inv.state !== 'result'
                // Pretty-print the tool call header so users see exactly
                // what the model asked for. We special-case the two
                // tools we ship — generic args dumps work but read as
                // noise; tailored summaries read as feedback.
                let title: string
                let detail: string | null = null
                if (name === 'web_search') {
                  const q = String(inv.args?.query ?? '')
                  title = isRunning ? `Searching the web…` : `Searched the web`
                  detail = q ? `“${q}”` : null
                } else if (name === 'run_javascript') {
                  title = isRunning ? `Running JavaScript…` : `Ran JavaScript`
                  const code = String(inv.args?.code ?? '')
                  // Show the first non-empty line as the detail so the
                  // user gets a hint of what executed without us
                  // dumping the whole snippet into the chat.
                  const firstLine = code.split('\n').find(l => l.trim().length > 0) ?? ''
                  detail = firstLine ? firstLine.slice(0, 80) : null
                } else if (name === 'bash') {
                  title = isRunning ? `Running shell…` : `Ran shell`
                  const cmd = String(inv.args?.command ?? '')
                  // Show the first non-empty line so the user can scan
                  // what the model asked the sandbox to do (e.g.
                  // `pdfinfo /mnt/user-data/uploads/x.pdf`).
                  const firstLine = cmd.split('\n').find(l => l.trim().length > 0) ?? ''
                  detail = firstLine ? firstLine.slice(0, 80) : null
                } else if (name === 'python') {
                  title = isRunning ? `Running Python…` : `Ran Python`
                  const code = String(inv.args?.code ?? '')
                  const firstLine = code.split('\n').find(l => l.trim().length > 0) ?? ''
                  detail = firstLine ? firstLine.slice(0, 80) : null
                } else {
                  title = isRunning ? `Calling ${name}…` : `Called ${name}`
                }

                // Result preview — a small, readable summary line under
                // the title once the tool has finished. We deliberately
                // keep it terse; the model's prose answer is still the
                // primary surface.
                let preview: string | null = null
                if (!isRunning && inv.result) {
                  if (name === 'web_search') {
                    const r = inv.result
                    if (r?.error) preview = `Error: ${String(r.error).slice(0, 120)}`
                    else if (Array.isArray(r?.results)) {
                      preview = `${r.results.length} result${r.results.length === 1 ? '' : 's'}`
                    }
                  } else if (name === 'run_javascript') {
                    const r = inv.result
                    if (r?.ok === false) preview = `Error: ${String(r.error ?? '').slice(0, 120)}`
                    else if (r?.result !== undefined) preview = `→ ${String(r.result).slice(0, 120)}`
                  } else if (name === 'bash' || name === 'python') {
                    // Sandbox tools share the same result envelope:
                    //   { ok, exitCode, stdout, stderr, ... }
                    // Surface either the first line of stdout (success
                    // case) or the truncated stderr (failure case) so
                    // the user gets a clear at-a-glance signal of what
                    // happened without scrolling.
                    const r = inv.result
                    if (r?.ok === false) {
                      const errLine = String(r?.stderr ?? '').split('\n').find((l: string) => l.trim()) ?? ''
                      preview = errLine
                        ? `Error (exit ${r?.exitCode ?? '?'}): ${errLine.slice(0, 120)}`
                        : `Error (exit ${r?.exitCode ?? '?'})`
                    } else if (r?.stdout) {
                      const firstOut = String(r.stdout).split('\n').find((l: string) => l.trim()) ?? ''
                      preview = firstOut ? `→ ${firstOut.slice(0, 120)}` : `→ exit ${r?.exitCode ?? 0}`
                    } else if (r?.exitCode !== undefined) {
                      preview = `→ exit ${r.exitCode}`
                    }
                  }
                }

                return (
                  <div
                    key={inv.toolCallId ?? ti}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 2,
                      padding: '6px 10px',
                      border: '1px solid currentColor',
                      borderRadius: 2,
                      opacity: isRunning ? 0.75 : 0.95,
                      fontSize: 12,
                    }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                      fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                    }}>
                      <span>{title}</span>
                      {isRunning && (
                        <span style={{ opacity: 0.7 }}>●</span>
                      )}
                    </div>
                    {detail && (
                      <div style={{ opacity: 0.85, fontStyle: 'italic' }}>
                        {detail}
                      </div>
                    )}
                    {preview && (
                      <div style={{
                        opacity: 0.7, fontSize: 11,
                        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                      }}>
                        {preview}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            )}
            {body}
            {outputFiles.length > 0 && <DownloadStrip files={outputFiles} />}
          </div>
        )
      }

      return {
        id: m.id ?? `a-${i}`,
        who: 'ai' as const,
        time,
        model: stampedModel ?? shortName(selectedModel.version, selectedModel.name),
        body: bodyWithTools,
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
    // Always create a fresh thread — `ensureActiveChat` would silently
    // return the *current* chat if it matches the modality, which is
    // why the "New chat" button was a no-op (the existing thread was
    // reused, no new row appeared in the sidebar). Going through
    // `createChat` directly fires `clox-chats-changed`, which the
    // recent-list effect now listens for, so the new thread shows up
    // immediately without a reload.
    const fresh = createChat({
      modality,
      title: 'New Chat',
      model: selectedModel.name,
    })
    setActiveChatIdState(fresh.id)
    persistActiveChatId(modality, fresh.id)
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
        // "See all →" in the sidebar header. Without this prop the
        // button rendered but did nothing on click, which felt broken.
        // We send users to the dedicated history page where they can
        // search / filter / archive across every modality.
        onSeeAllRecent={() => router.push('/history')}
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
        skills={availableSkills}
        selectedSkillIds={activeSkillIds}
        onToggleSkill={handleToggleSkill}
        onClearSkills={handleClearSkills}
        autoDetectedSkillIds={autoDetectedSkillIds}
        onDismissAutoSkill={handleDismissAutoSkill}
        transcript={transcript}
        isStreaming={isStreaming}
        inputValue={input}
        onInputChange={setInput}
        onSend={handleSend}
        attachments={attachments}
        onAttach={handleAttach}
        onRemoveAttachment={handleRemoveAttachment}
        toolsState={toolsState}
        onToggleTool={handleToggleTool}
        // Display the number of user-armed *toggles*, not the underlying
        // tool-id count. The "python sandbox" toggle expands to two ids
        // (`bash` + `python`) so using `enabledToolIds.length` would
        // make the chip read "2" after a single click and confuse users
        // about what they actually armed.
        toolsCount={toolsState.filter(t => t.on).length}
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
