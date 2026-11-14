'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeArtifact } from '@/shared/ui/components/CodeArtifact'
import { DownloadStrip, type DownloadStripFile } from '@/shared/ui/components/DownloadStrip'
import { BrowserPanel, type BrowserInvocation, type BrowserProgressEvent } from '@/shared/ui/components/BrowserPanel'
import { WorkLog, type WorkStep } from '@/shared/ui/chat/WorkLog'
import { SandboxStatus, StatusLine } from '@/shared/ui/chat/SandboxStatus'
import { closePreview } from '@/shared/ui/chat/preview-store'
import useSWR from 'swr'

import WorkspaceSlot from '@/shared/ui/chat/workspace-host'
import {
  type Attachment,
  type ModeOption,
  type ModelOption,
  type RailNavItem,
  type TranscriptMessage,
} from '@/shared/ui/chat/ChatWorkspace'
import { I } from '@/shared/ui/chat/icons'
import {
  getStoredPalette,
  initialPalette,
  markPaletteSeen,
  setStoredPalette,
  type PaletteKey,
} from '@/shared/ui/chat/palettes'

import {
  TEXT_MODELS,
  IMAGE_MODELS,
  VIDEO_MODELS,
  AUDIO_MODELS,
  defaultModelId,
  resolveModelId,
} from '@/lib/gateway/catalog'
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
import {
  estimateTokensForString,
  estimateTokensForMessages,
  formatTokenCount,
} from '@/lib/token-estimate'
import { useAvailableModels } from '@/lib/use-available-models'
import { createClient } from '@/lib/supabase/client'
import { markSignedOut } from '@/lib/gaia-sso-config'
import {
  createChat,
  ensureActiveChat,
  getActiveChatId,
  getChatById,
  listChats,
  setActiveChatId as persistActiveChatId,
  touchChat,
  type Chat,
} from '@/lib/chat-store'
import type { AppLanguage } from '@/shared/ui/chat/ChatWorkspace'
import { SIGNED_OUT_USER, cachedIdentity, watchIdentity } from '@/shared/ui/chat/chrome-identity'
import { saveTranscript } from '@/lib/transcript-store'
import { restoreTranscript } from '@/lib/chat-cloud'
import { fitAttachments } from '@/lib/request-fit'
import { parseStored } from '@/lib/storage/file-url'

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

type ChatFileRow = { filename: string; url: string; mime: string; size: number; updatedAt: string }

function timeOf(value: unknown): number | null {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string' || typeof value === 'number') {
    const t = new Date(value).getTime()
    return Number.isFinite(t) ? t : null
  }
  return null
}

/** Assistant prose: markdown, with every fenced block rendered as a
 *  downloadable / previewable artifact. */
function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeArtifact,
          table: ({ children }) => (
            <div className="prose-table-wrap">
              <table>{children}</table>
            </div>
          ),
          // CodeArtifact ships its own framed container; a second <pre>
          // would double-pad and disable horizontal scroll.
          pre: ({ children }) => <>{children}</>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
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
  // Voice mode lists speech, music and sound-effect models — they all
  // turn a prompt into audio. The picker groups them by provider.
  const enabledAudioModels = useAvailableModels(AUDIO_MODELS)

  /* ----- theme ------------------------------------------------------- */
  // Initial paint comes from the blocking script in `layout.tsx`, which
  // already applied `data-theme` + `.dark` synchronously. Here we just
  // mirror the value into React state so the inline-styled palette
  // regions (which read this `theme` variable) match what's already on
  // the html element. We deliberately do NOT touch the DOM attributes
  // here — those are owned by `setStoredPalette` to avoid double writes.
  const [theme, setTheme] = useState<PaletteKey>(() => initialPalette('pearl'))
  useEffect(() => {
    setTheme(getStoredPalette('pearl'))
    markPaletteSeen()
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
  const [selectedTextModel, setSelectedTextModel]   = useState<typeof TEXT_MODELS[number]>(
    () => TEXT_MODELS.find(m => m.id === defaultModelId('text')) ?? TEXT_MODELS[0],
  )
  const [selectedImageModel, setSelectedImageModel] = useState<typeof IMAGE_MODELS[number]>(
    () => IMAGE_MODELS.find(m => m.id === defaultModelId('image')) ?? IMAGE_MODELS[0],
  )
  const [selectedVideoModel, setSelectedVideoModel] = useState<typeof VIDEO_MODELS[number]>(
    () => VIDEO_MODELS.find(m => m.id === defaultModelId('video')) ?? VIDEO_MODELS[0],
  )
  const [selectedAudioModel, setSelectedAudioModel] = useState<typeof AUDIO_MODELS[number]>(
    () => AUDIO_MODELS.find(m => m.id === defaultModelId('audio')) ?? AUDIO_MODELS[0],
  )

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
        const model = TEXT_MODELS.find(m => m.id === resolveModelId(settings.modelId, 'text'))
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
  // Append the active DB skills to the system prompt for every text
  // request. `buildSkillsBlock` concatenates each row's full
  // `system_prompt` under a `### Name` header, so multi-paragraph
  // prompts (Anthropic-style document specialists, the frontend-
  // designer brief, …) keep their structure. Short overlay prompts
  // (Concise, Step-by-step, JSON only) come through with the same
  // formatting — they're just shorter, no special-casing needed. */
  /* ----- per-modality params ---------------------------------------
     One bag per modality so flipping back and forth keeps the user's
     knobs intact. The ConfigDrawer reads from / writes to the slot that
     matches the current modality. Declared above useChat because its
     body forwards `textParams`. Reset when the model changes so a knob
     from one model never leaks into another model's request. */
  const [textParams,  setTextParams]  = useState<Record<string, unknown>>({})
  const [imageParams, setImageParams] = useState<Record<string, unknown>>({})
  const [videoParams, setVideoParams] = useState<Record<string, unknown>>({})
  const [audioParams, setAudioParams] = useState<Record<string, unknown>>({})
  useEffect(() => { setImageParams({}) }, [selectedImageModel.id])
  useEffect(() => { setVideoParams({}) }, [selectedVideoModel.id])
  useEffect(() => { setAudioParams({}) }, [selectedAudioModel.id])
  useEffect(() => {
    setTextParams(prev => {
      const keep: Record<string, unknown> = {}
      if (prev.temperature !== undefined) keep.temperature = prev.temperature
      return keep
    })
  }, [selectedTextModel.id])

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
    const TOOL_LABELS = ['web search', 'browser', 'code execute', 'python sandbox'] as const
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
      if (t.label === 'browser')        ids.push('browser')
    }
    return ids
  }, [toolsState])

  const chatRequestBodyRef = useRef<Record<string, unknown>>({})
  const chat = useChat({
    id: activeChatId,
    api: '/api/chat',
    body: chatRequestBodyRef.current = {
      model: selectedTextModel.id,
      provider: selectedTextModel.provider,
      systemPrompt: composedSystemPrompt,
      temperature,
      maxTokens,
      // Every other knob from the config pane (reasoning effort, stop
      // sequences, JSON output, …). The route only applies the keys the
      // selected model accepts.
      params: textParams,
      // Forward the user's enabled tools so /api/chat can attach the
      // matching tool definitions to streamText. Sending an empty list
      // is cheap and explicit; the route reads `tools: []` as "no
      // tools, behave like a plain chat" with zero overhead.
      tools: enabledToolIds,
      // CRITICAL — the route's `sandboxArmed` check is gated on
      // `Boolean(chatId)`, and `useChat`'s top-level `id` field is
      // NOT forwarded as `chatId` in the POST body (it's only used
      // for the SDK's internal message store). Without this line,
      // every request had chatId=undefined → sandboxArmed=false →
      // the python/bash tools were silently NEVER attached to
      // streamText. The model then had no choice but to emit the
      // entire deck (a 600-line pptxgenjs script) as a fenced
      // artifact, which costs 25-30k output tokens and truncates
      // mid-deck even with the 128k beta header. With this field
      // present, the sandbox boots once per chat, lives across all
      // turns (including "continue"), and the model uses
      // python-pptx (stateful, incremental) instead.
      chatId: activeChatId,
    },
    // useChat resends the whole conversation every turn, attachments
    // included. A couple of earlier images pushed the request past the
    // 4.5 MB body limit of the hosting platform and every later message
    // failed. Older attachment bodies are dropped (newest kept) until the
    // request fits; the text of the conversation always goes.
    experimental_prepareRequestBody: ({ id, messages, requestData, requestBody }) => ({
      id,
      messages: fitAttachments(messages),
      data: requestData,
      ...chatRequestBodyRef.current,
      ...(requestBody as object | undefined),
    }),
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
  // Pull `error` and `reload` from useChat too. Without these, a
  // streamText failure mid-tool-call becomes invisible: useChat ends
  // streaming silently, the transcript stops growing, and the user
  // has no way to know the request failed or to recover. Surfacing
  // both lets us render an inline "Stream error / No response — Retry"
  // panel below the transcript that always appears when the chat ends
  // in a non-clean state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages = [], input = '', handleInputChange, handleSubmit, isLoading = false, status, setMessages, error: chatError, reload: chatReload } = chat as any
  const liveStreaming = Boolean(isLoading) || status === 'submitted' || status === 'streaming'
  const liveStreamingRef = useRef(liveStreaming)
  liveStreamingRef.current = liveStreaming

  // Requests from outside the composer (the preview's font picker). The
  // sender learns whether it went through: not while a reply is running.
  const chatRef = useRef(chat)
  chatRef.current = chat
  useEffect(() => {
    const onAsk = (e: Event) => {
      const detail = (e as CustomEvent<{ text?: string; accepted?: boolean }>).detail
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const append = (chatRef.current as any)?.append as
        | ((message: { role: 'user'; content: string }) => Promise<unknown>)
        | undefined
      if (!detail?.text || liveStreamingRef.current || !append) return
      detail.accepted = true
      void append({ role: 'user', content: detail.text })
    }
    window.addEventListener('clox-ask', onAsk)
    return () => window.removeEventListener('clox-ask', onAsk)
  }, [])

  // The server keeps generating when this tab reloads or closes, and saves
  // the reply as it grows. On opening a chat we pick that reply up and
  // follow it until it finishes.
  const [resumingRun, setResumingRun] = useState(false)
  // A dropped connection (sleep, network change) ends the live stream with
  // an error while the server carries on — look for the saved reply then too.
  const [resumeTick, setResumeTick] = useState(0)
  useEffect(() => { if (chatError) setResumeTick(t => t + 1) }, [chatError])
  useEffect(() => {
    if (!activeChatId || !setMessages) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    type RunMsg = { id: string; content?: string; toolInvocations?: unknown[]; annotations?: unknown[] }
    const size = (m: RunMsg | undefined) =>
      m ? (m.content?.length ?? 0) + (m.toolInvocations?.length ?? 0) * 1000 + (m.annotations?.length ?? 0) : -1
    const check = async (first: boolean) => {
      if (cancelled) return
      if (liveStreamingRef.current) { setResumingRun(false); return }
      const res = await fetch(`/api/chat/runs?chatId=${encodeURIComponent(activeChatId)}`, { cache: 'no-store' }).catch(() => null)
      const run = res?.ok ? (await res.json().catch(() => null))?.run : null
      if (cancelled || liveStreamingRef.current) return
      const msg = run?.message as RunMsg | undefined
      if (!msg?.id) { setResumingRun(false); return }
      setMessages((prev: Array<RunMsg & Record<string, unknown>>) => {
        const at = prev.findIndex(m => m.id === msg.id)
        if (at >= 0) {
          if (run.status !== 'running' && size(prev[at]) >= size(msg)) return prev
          const next = [...prev]
          next[at] = { ...msg, clox_model: prev[at].clox_model, ...(prev[at].createdAt ? { createdAt: prev[at].createdAt } : {}) }
          return next
        }
        if (prev[prev.length - 1]?.role !== 'user') return prev
        if (!first && run.status !== 'running') return prev
        return [...prev, msg]
      })
      if (run.status === 'running') {
        setResumingRun(true)
        timer = setTimeout(() => void check(false), 2000)
      } else {
        setResumingRun(false)
      }
    }
    timer = setTimeout(() => void check(true), 400)
    return () => { cancelled = true; if (timer) clearTimeout(timer); setResumingRun(false) }
  }, [activeChatId, setMessages, resumeTick])

  const isStreaming = liveStreaming || resumingRun

  // Files open in the side preview by themselves only when a reply was
  // made while the chat was open here — not when an old chat is reopened.
  const [streamedHere, setStreamedHere] = useState(false)
  if (isStreaming && !streamedHere) setStreamedHere(true)
  useEffect(() => {
    setStreamedHere(false)
    closePreview()
  }, [activeChatId])

  // This chat's files, so a reply always offers what it made even when the
  // "file ready" note from the server didn't reach the tab.
  const { data: chatFilesData, mutate: refreshChatFiles } = useSWR<{ files?: ChatFileRow[] }>(
    activeChatId ? `/api/files?chatId=${encodeURIComponent(activeChatId)}` : null,
    (url: string) => fetch(url, { cache: 'no-store' }).then(r => (r.ok ? r.json() : { files: [] })),
    { revalidateOnFocus: false },
  )
  const chatFiles = chatFilesData?.files ?? []
  const wasStreaming = useRef(isStreaming)
  useEffect(() => {
    const ended = wasStreaming.current && !isStreaming
    wasStreaming.current = isStreaming
    if (!ended) return
    void refreshChatFiles()
    // Uploads can land a moment after the stream closes.
    const later = setTimeout(() => void refreshChatFiles(), 4000)
    return () => clearTimeout(later)
  }, [isStreaming, refreshChatFiles])
  const setInput = (v: string) => {
    handleInputChange?.({ target: { value: v } } as unknown as React.ChangeEvent<HTMLTextAreaElement>)
  }

  // ── Auto-fallback on Claude rate-limit ─────────────────────────
  //
  // Anthropic's tier-1 cap is 10k input tokens/minute. A single doc
  // skill primer load + tool definitions + recent history can hit
  // that cap on the first request of a turn, even with prompt
  // caching. The existing recovery banner offers a manual "Switch
  // to Haiku 4.5 & Retry" button — but the user has explicitly
  // asked for this to happen automatically so document builds feel
  // as reliable as Claude.ai's own interface.
  //
  // The effect below fires the SAME swap-and-retry the manual
  // button does, but does so as soon as `chatError` materialises.
  // Dedup is keyed off the last user-message id so:
  //   1. We auto-switch at most ONCE per user turn (no infinite
  //      loop if Haiku itself 429s — the banner will then show
  //      and the user can pick a different action).
  //   2. A fresh user send creates a new last-user-msg-id and re-
  //      enables auto-fallback for the next turn.
  //
  // We only fall back FROM Claude flagships (Sonnet/Opus). Other
  // providers don't share the same per-minute squeeze, and a
  // cross-provider hop without user consent feels wrong; for
  // those, the manual banner remains the path.
  const lastAutoFallbackUserMsgIdRef = useRef<string | null>(null)
  const [autoFallbackPendingForMsgId, setAutoFallbackPendingForMsgId] = useState<string | null>(null)
  useEffect(() => {
    if (!chatError) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user')
    if (!lastUserMsg?.id) return
    if (lastAutoFallbackUserMsgIdRef.current === lastUserMsg.id) return

    const raw = chatError instanceof Error ? chatError.message
      : String((chatError as { message?: unknown })?.message ?? chatError)
    const isRateLimit = /rate.?limit|429|tokens? per (minute|second)|tpm|exceed/i.test(raw.toLowerCase())
    if (!isRateLimit) return

    const currentId = selectedTextModel.id
    const isClaudeFlagship = /^anthropic\/claude-(opus|sonnet)/.test(currentId)
    if (!isClaudeFlagship) return

    // Opus → Sonnet first (same family, higher quota), Sonnet → Haiku.
    // Mirrors the manual banner's alternateModel picker so auto and
    // manual paths agree.
    const fallbackId = currentId.includes('opus')
      ? 'anthropic/claude-sonnet-4.6'
      : 'anthropic/claude-haiku-4.5'
    const fallback = TEXT_MODELS.find(m => m.id === fallbackId)
    if (!fallback) return

    // Record dedup key BEFORE firing reload so any re-render
    // racing through this effect for the same user msg short-
    // circuits at the guard above.
    lastAutoFallbackUserMsgIdRef.current = lastUserMsg.id
    setAutoFallbackPendingForMsgId(lastUserMsg.id)
    setSelectedTextModel(fallback)

    const altLabel = shortName(fallback.version, fallback.name)
    if (pendingModelRef.current.length > 0) {
      pendingModelRef.current[0] = altLabel
    } else {
      pendingModelRef.current.push(altLabel)
    }

    console.log('[v0] auto-fallback', {
      from: currentId,
      to: fallback.id,
      forUserMsg: lastUserMsg.id,
    })

    try {
      chatReload?.({
        body: {
          model: fallback.id,
          provider: fallback.provider,
          systemPrompt: composedSystemPrompt,
          temperature,
          maxTokens,
          params: textParams,
          tools: enabledToolIds,
        },
      })
    } catch (e) {
      console.error('[v0] auto-fallback reload failed', e)
    }
    // Intentionally omit composedSystemPrompt / temperature / maxTokens /
    // textParams / enabledToolIds from the dep list: they're read
    // at fire-time inside the body builder, and including them would
    // re-run this effect every time those values churn (e.g. the
    // user toggles a skill mid-stream), risking duplicate reloads.
    // The dedup ref protects us either way.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatError, messages, selectedTextModel.id, chatReload])

  // Clear the "pending" UI flag once a new stream actually starts.
  // Without this, the banner would keep showing the auto-fallback
  // copy after Haiku had already begun producing tokens.
  useEffect(() => {
    if (isStreaming && autoFallbackPendingForMsgId) {
      setAutoFallbackPendingForMsgId(null)
    }
  }, [isStreaming, autoFallbackPendingForMsgId])

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
  //
  // Writing the whole transcript on every streamed chunk serialised
  // megabytes (tool scripts, results, attached files) many times a second
  // and froze the page. While a reply streams we save once it goes quiet;
  // the server keeps the reply anyway (chat_runs), so nothing is lost.
  const pendingSave = useRef<{ id: string; messages: unknown[]; timer: number } | null>(null)
  useEffect(() => {
    if (!activeChatId || !chat.messages || chat.messages.length === 0) return
    const busy = status === 'streaming' || status === 'submitted'
    const previous = pendingSave.current
    if (previous) {
      window.clearTimeout(previous.timer)
      if (previous.id !== activeChatId) saveTranscript(previous.id, previous.messages)
    }
    const entry = { id: activeChatId, messages: chat.messages as unknown[], timer: 0 }
    entry.timer = window.setTimeout(() => {
      saveTranscript(entry.id, entry.messages)
      if (pendingSave.current === entry) pendingSave.current = null
    }, busy ? 2000 : 150)
    pendingSave.current = entry
  }, [chat.messages, activeChatId, status])
  useEffect(() => () => {
    const last = pendingSave.current
    if (last) { window.clearTimeout(last.timer); saveTranscript(last.id, last.messages) }
  }, [])

  useEffect(() => {
    if (!setMessages) return
    const saved = localStorage.getItem(`chat-history-${activeChatId}`)
    if (saved) {
      try { setMessages(parseStored(saved)) } catch { setMessages([]) }
      return
    }
    setMessages([])
    // Not in this browser (another device, cleared storage, or evicted to
    // make room): load the server copy.
    if (!activeChatId || !getChatById(activeChatId)) return
    let cancelled = false
    restoreTranscript(activeChatId).then(history => {
      if (!cancelled && history?.length) setMessages(history as Parameters<typeof setMessages>[0])
    })
    return () => { cancelled = true }
  }, [activeChatId, setMessages])

  /* ----- attachments ------------------------------------------------- */
  // The page owns the attachment list; ChatWorkspace just renders it. We
  // serialise files to data URLs so they survive re-renders cleanly and can
  // be passed straight to useChat's `experimental_attachments`.
  const [attachments, setAttachments] = useState<Attachment[]>([])

  // Files travel inside the request as base64 (+33%), and the hosting
  // platform refuses bodies over 4.5 MB — an 8 MB cap let people attach
  // files that could never be sent.
  const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024 // 3 MB per file

  async function handleAttach(files: FileList) {
    const next: Attachment[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        window.alert(`"${file.name}" is too large to attach (max 3 MB).`)
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
      // Phase 2 (lazy skill loading): replace the multi-paragraph
      // skill prose we used to inject with a 1-line STUB that names
      // the auto-detected skill and points the model at the
      // `read_skill` tool. The full prompt only enters context when
      // (and if) the model actually decides to load it — saving
      // ~2k tokens on the common case where the auto-detected skill
      // is the right one and the model just needs the schema bits
      // it can already glean from the slim index in stableSystem.
      //
      // We keep this as a STUB rather than dropping it entirely so
      // the model gets a strong nudge ("auto-detected: PDF Document
      // Specialist") and can decide for itself whether to load.
      // Without the nudge, the model falls back to the index alone
      // and may not realise the user's intent matched a specialist.
      const autoBlock = autoSkills.length > 0
        ? [
            '',
            '## Auto-detected skills for this turn',
            '',
            ...autoSkills.map(s => {
              const desc = s.description ? ` — ${s.description}` : ''
              return `- (${s.id}) ${s.name}${desc}`
            }),
            '',
            'These skills look relevant to the user\'s request. If you',
            'need their full guidance, call `read_skill({"skill_id":',
            '"<id>"})` to load it. If the slim description above is',
            'enough for this request, proceed without loading.',
            '',
          ].join('\n')
        : ''
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

    // Reference images / start frames ride along as data URLs. Only image
    // and video models take them.
    const mediaFiles = modality === 'image' || modality === 'video'
      ? attachments
          .filter(a => a.contentType.startsWith('image/'))
          .map(a => ({ name: a.name, contentType: a.contentType, url: a.dataUrl }))
      : []
    setAttachments([])

    try {
      // Media-gen routes accept a single `prompt` string. We thread the
      // active skills through by prepending a tight directive built from
      // each skill's `system_prompt`. `resolveSkills` drops any unknown
      // ids (stale localStorage etc.) and `buildSkillsPromptPrefix`
      // returns '' when nothing is active, so the prompt is unchanged
      // when no skills are selected.
      const activeMediaRows = resolveSkills(dbSkills.skills, activeSkillIds)
      const skillsPrefix    = buildSkillsPromptPrefix(activeMediaRows)
      const composedPrompt  = skillsPrefix + promptText

      let result: { url?: string; urls?: string[]; durationSec?: number; error?: string; warnings?: string[] } = {}
      const endpoint =
        modality === 'image' ? '/api/generate-image' :
        modality === 'video' ? '/api/generate-video' : '/api/generate-audio'
      const params =
        modality === 'image' ? imageParams :
        modality === 'video' ? videoParams : audioParams
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: composedPrompt,
          model: selectedModel.id,
          params,
          files: mediaFiles,
          chatId: activeChatId,
        }),
      })
      result = await res.json().catch(() => ({ error: `Generation failed (${res.status})` }))
      if (!res.ok || !result.url) throw new Error(result.error || `Generation failed (${res.status})`)
      if (result.warnings?.length) console.warn('[clox] model ignored some settings:', result.warnings)

      setMessages?.((prev: unknown[]) =>
        (prev as Array<Record<string, unknown>>).map(m =>
          m.id === aiId
            ? {
                ...m,
                content: result.warnings?.length
                  ? `The model ignored: ${result.warnings.join('; ')}`
                  : '',
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
        tag: connected ? m.id : 'gateway not connected',
        group: m.brandName,
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
    const base: TranscriptMessage[] = (messages as any[]).map((m, i) => {
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
          /*
           * Just `.prose` — the hand-rolled rules in globals.css
           * (line ~276) own the editorial typography. The earlier
           * `dark:prose-invert prose-zinc prose-p:my-2 …` classes
           * were copy-pasted from a Tailwind Typography example
           * but did nothing here because this project does NOT
           * have `@tailwindcss/typography` installed. Real prose
           * styling comes from `.prose`, `.prose p`, `.prose h*`
           * etc. defined in globals.css, and those rules now
           * inherit `color` from the parent message card so the
           * JS palette (onyx vs pearl) is the single source of
           * truth for text colour — fixing the dark-on-dark text
           * bug after reloads.
           */
          <AssistantMarkdown text={String(m.content ?? '')} />
        )
      }

      // Prefer the model label that was captured at the time this
      // message was generated. We only fall back to the live picker
      // for an in-flight assistant response that hasn't reached
      // `onFinish` yet (i.e. it never got `clox_model` stamped).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const autoPicked = ((m as any).annotations as Array<{ type?: string; name?: string }> | undefined)
        ?.find(a => a?.type === 'auto-model')?.name
      const stampedModel = autoPicked
        ? `Auto · ${autoPicked.replace(/^Claude\s+/, '')}`
        : typeof m.clox_model === 'string' ? m.clox_model : undefined

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

      // Auto-compaction notice. The route writes a single `compaction`
      // annotation per turn when older messages were folded into a
      // summary. We surface it as a small inline badge above the
      // download strip so the user understands why their chat
      // suddenly fits in the model's context — and so they can verify
      // older context isn't being silently dropped without their
      // awareness. */
      const compactionAnnotation:
        | { type: 'compaction'; compactedCount: number; beforeTokens: number; afterTokens: number }
        | undefined =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        annotations.find((a: any) => a && a.type === 'compaction') as
          | { type: 'compaction'; compactedCount: number; beforeTokens: number; afterTokens: number }
          | undefined

      // ── Finish-reason warning ──────────────────────────────────
      // The route writes this annotation in `onFinish` when the
      // model stopped because it hit the output token cap
      // ('length') or the tool-step cap ('other'). Both look
      // identical from the user's view — the message just ends
      // mid-sentence — so without this banner the user has no way
      // to know whether to retry, rephrase, or simply say
      // "continue". We surface the reason + a recommended action
      // so they know exactly what's going on.
      const finishWarning:
        | { type: 'finish-warning'; reason: 'length' | 'other'; message: string }
        | undefined =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        annotations.find((a: any) => a && a.type === 'finish-warning') as
          | { type: 'finish-warning'; reason: 'length' | 'other'; message: string }
          | undefined

      // ── Sandbox progress strip ─────────────────────────────────────
      // We surface three kinds of progress so the user always sees
      // SOMETHING moving when the sandbox is at work:
      //
      //   1. Server-streamed `sandbox-progress` annotations
      //      (boot / install lifecycle from the manager + tool calls).
      //   2. Per-tool-invocation status from useChat itself
      //      (`state: 'partial-call' | 'call' | 'result'`).
      //   3. A fallback "Working in Python sandbox…" pulse on the
      //      in-flight last assistant message even before any of the
      //      above arrive — annotations can be late or buffered, and
      //      a totally blank chat while the user waits 10s for the
      //      microVM to boot is the symptom they keep reporting.
      type ProgressEvent = {
        type: 'sandbox-progress'
        phase:
          | 'sandbox-booting' | 'sandbox-ready' | 'sandbox-failed'
          | 'deps-installing' | 'deps-ready'    | 'deps-failed'
          | 'snippet-running' | 'snippet-done'  | 'snippet-timeout'
        ts?: number
        durationMs?: number
        error?: string
        tool?: 'python' | 'bash'
        preview?: string
      }
      const browserInvocations = toolInvocations.filter(inv => inv.toolName === 'browser') as BrowserInvocation[]
      const browserProgress: BrowserProgressEvent[] = annotations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((a: any) => a && a.type === 'browser-progress' && typeof a.phase === 'string')
      const progressEvents: ProgressEvent[] = annotations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((a: any) => a && a.type === 'sandbox-progress' && typeof a.phase === 'string')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((a: any) => !String(a.phase).startsWith('snippet-'))

      // Format a phase event into a human readable line. Successful
      // deps-ready / sandbox-ready entries get the duration in
      // seconds because that's the most meaningful signal about
      // whether the boot was a cold start or a warm reuse.
      const formatProgress = (e: ProgressEvent): string => {
        const secs = e.durationMs ? `${Math.max(1, Math.round(e.durationMs / 1000))}s` : ''
        switch (e.phase) {
          case 'sandbox-booting': return 'Starting Python sandbox…'
          case 'sandbox-ready':   return `Sandbox ready${secs ? ` (${secs})` : ''}`
          case 'sandbox-failed':  return `Sandbox boot failed: ${e.error ?? 'unknown error'}`
          case 'deps-installing': return 'Installing Python packages (~30–40s)…'
          case 'deps-ready':      return `Packages ready${secs ? ` (${secs})` : ''}`
          case 'deps-failed':     return `Package install failed${secs ? ` after ${secs}` : ''}: ${e.error ?? ''}`
          default:                return ''
        }
      }

      // Last-message + in-flight detection. `isStreaming` is the
      // route's own status; the message at the tail of `messages` is
      // the assistant turn currently being filled in. Only this
      // message gets the "Working…" fallback strip and the post-stream
      // continue button — older completed turns shouldn't show those
      // affordances.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isLastMessage = i === ((messages as any[]).length - 1)
      const isInFlight    = isStreaming && isLastMessage

      // Tool the model is actively executing. v4 uses these states:
      //   partial-call → arguments still streaming
      //   call         → arguments complete, execute() running
      //   result       → execute() returned (or threw)
      const inFlightTool = toolInvocations.find(inv => inv.state !== 'result')

      // ── Timeout / cut-off detection ────────────────────────────────
      // Three failure modes we want to recover from with one click:
      //   (a) A tool returned the structured `kind: 'timeout'` shape
      //       (python / bash hit their 180s wall-clock cap).
      //   (b) Stream finished but a tool is still in a non-result
      //       state (server cut off mid-execution).
      //   (c) Stream finished with no body and no successful tools
      //       (something silently failed upstream).
      // Only when the timeout is what the reply ended on — a model that
      // recovered from a slow step and carried on needs no button.
      const lastInvocation = toolInvocations[toolInvocations.length - 1]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgParts: Array<{ type?: string; text?: string }> = Array.isArray((m as any).parts) ? (m as any).parts : []
      const lastToolPart = msgParts.map(p => p.type).lastIndexOf('tool-invocation')
      const wroteAfterTool = lastToolPart >= 0 &&
        msgParts.slice(lastToolPart + 1).some(p => p.type === 'text' && String(p.text ?? '').trim().length > 0)
      const timedOutTool = isLastMessage && !isStreaming && !wroteAfterTool &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (lastInvocation?.result as any)?.kind === 'timeout'
        ? lastInvocation
        : undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const timeoutSuggestion: string | null = timedOutTool
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? String((timedOutTool.result as any)?.suggestion ?? '')
        : null
      const wasStreamCutOff =
        isLastMessage && !isStreaming && Boolean(inFlightTool)
      const wasEmptyOutput =
        isLastMessage && !isStreaming && !inFlightTool && toolInvocations.length === 0 &&
        String(m.content ?? '').trim().length === 0
      const showContinueButton = Boolean(timedOutTool) || wasStreamCutOff || wasEmptyOutput

      const onContinueClick = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const append = (chat as any).append as
          | ((message: { role: 'user'; content: string }) => Promise<unknown>)
          | undefined
        if (!append) return
        const hint =
          timeoutSuggestion ||
          'Split the work into smaller chunks (one slide / page / sheet ' +
          'per python call) and continue from where you left off.'
        const reason = timedOutTool
          ? 'The previous step timed out before it could finish.'
          : wasStreamCutOff
            ? 'The previous response was cut off mid-tool-call.'
            : 'The previous response came back empty.'
        void append({
          role: 'user',
          content: `${reason} Continue from where you stopped — ${hint}`,
        })
      }

      // Steps and prose in the order they happened: the model's notes
      // between steps ("that failed, trying another way") sit next to the
      // steps they talk about instead of piling up under every card.
      const skillName = (id: string) => dbSkills.skills.find(s => s.id === id)?.name
      const workSteps = toolInvocations.filter(inv => inv.toolName !== 'browser') as WorkStep[]
      const interleaved = !pending && !errored && !mediaKind &&
        msgParts.some(part => part.type === 'tool-invocation')
      const replySegments: React.ReactNode[] = []
      if (interleaved) {
        let group: WorkStep[] = []
        const flush = (key: string, live: boolean) => {
          if (group.length === 0) return
          replySegments.push(<WorkLog key={key} steps={group} live={live} skillName={skillName} />)
          group = []
        }
        msgParts.forEach((part, pi) => {
          if (part.type === 'tool-invocation') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const inv = (part as any).toolInvocation as WorkStep | undefined
            if (inv && inv.toolName !== 'browser') group.push(inv)
          } else if (part.type === 'text' && String(part.text ?? '').trim()) {
            flush(`w${pi}`, false)
            replySegments.push(<AssistantMarkdown key={`t${pi}`} text={String(part.text)} />)
          }
        })
        flush('w-end', isInFlight)
      }

      // Files made in this turn. The server attaches them to the reply when
      // it finishes; if that note never reached this tab (long builds, a
      // dropped connection) they still exist in the chat's file library.
      const ranSandbox = toolInvocations.some(inv => inv.toolName === 'python' || inv.toolName === 'bash')
      const turnFiles: DownloadStripFile[] = [...outputFiles]
      if (ranSandbox && !isInFlight && chatFiles.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = messages as any[]
        const prevUser = [...list.slice(0, i)].reverse().find(x => x?.role === 'user')
        const nextUser = list.slice(i + 1).find(x => x?.role === 'user')
        const from = timeOf(prevUser?.createdAt) ?? timeOf(m.createdAt)
        const to = timeOf(nextUser?.createdAt) ?? Number.POSITIVE_INFINITY
        if (from !== null) {
          const known = new Set(turnFiles.map(f => f.filename))
          for (const f of chatFiles) {
            const at = timeOf(f.updatedAt)
            if (at === null || at < from - 5_000 || at >= to || known.has(f.filename) || f.filename.startsWith('.')) continue
            known.add(f.filename)
            turnFiles.push({ filename: f.filename, url: f.url, mime: f.mime, size: f.size })
          }
        }
      }

      let bodyWithTools: React.ReactNode = body
      if (
        toolInvocations.length > 0 ||
        turnFiles.length > 0 ||
        progressEvents.length > 0 ||
        showContinueButton ||
        // A finish-warning is meaningful on its own — the model may
        // have stopped mid-prose without ever calling a tool or
        // producing a file. We still need the wrapper to render the
        // banner so the user knows WHY the answer is truncated.
        finishWarning !== undefined ||
        // Render the wrapper while in-flight so the fallback "Working
        // in Python sandbox…" pulse below has a chance to appear even
        // before the model has emitted its first tool call. Without
        // this gate the assistant message would be visually empty for
        // 5–40s during a cold sandbox boot, which is exactly the
        // "stuck" complaint we're trying to fix.
        isInFlight
      ) {
        bodyWithTools = (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isInFlight && progressEvents.length === 0 && !inFlightTool && (
              // Annotation-free fallback: the moment the assistant
              // starts streaming, before any sandbox event has
              // arrived, show a single pulsing line so the chat is
              // never blank. Replaced as soon as a real progress
              // event or tool invocation comes through (the
              // `progressEvents.length === 0 && !inFlightTool` guard
              // collapses this away once richer signal arrives).
              <div role="status" aria-live="polite">
                <style>{`@keyframes cloxPulse { 0%,100%{opacity:1} 50%{opacity:.25} }`}</style>
                <StatusLine state="pending" text="Working · the first step can take up to a minute" />
              </div>
            )}
            {progressEvents.length > 0 && (
              <SandboxStatus
                live={isInFlight}
                lines={progressEvents.map(e => ({
                  text: formatProgress(e),
                  state: e.phase === 'sandbox-failed' || e.phase === 'deps-failed'
                    ? 'failed'
                    : e.phase === 'sandbox-booting' || e.phase === 'deps-installing' ? 'pending' : 'done',
                }))}
              />
            )}
            {browserInvocations.length > 0 && (
              <BrowserPanel invocations={browserInvocations} progress={browserProgress} live={isInFlight} />
            )}
            {interleaved ? replySegments : (
              <>
                {workSteps.length > 0 && <WorkLog steps={workSteps} live={isInFlight} skillName={skillName} />}
                {body}
              </>
            )}
            {showContinueButton && (
              // Click-to-continue affordance. Three failure modes
              // resolve to the same UI: (a) explicit timeout from the
              // python/bash tool, (b) the stream was cut off mid-
              // tool-call, (c) the assistant produced nothing visible.
              // The handler appends a user message that carries the
              // model's own suggestion forward (or a generic chunking
              // hint when none is available) — chat history preserves
              // any partial work the model produced before the
              // failure, so it resumes instead of starting over.
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 12,
                background: 'color-mix(in oklab, var(--accent, #b00020) 9%, transparent)',
                fontSize: 12,
              }}>
                <div style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  opacity: 0.85,
                }}>
                  {timedOutTool ? 'Step timed out' :
                   wasStreamCutOff ? 'Response cut off' :
                   'Empty response'}
                </div>
                <div style={{ opacity: 0.85, fontStyle: 'italic' }}>
                  {timeoutSuggestion ||
                   (wasStreamCutOff
                     ? 'The assistant was still running a tool when the response ended.'
                     : 'The assistant returned without producing visible output.')}
                </div>
                <button
                  type="button"
                  onClick={onContinueClick}
                  disabled={isStreaming}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '6px 14px',
                    border: 0,
                    borderRadius: 999,
                    background: 'color-mix(in oklab, currentColor 12%, transparent)',
                    color: 'inherit',
                    cursor: isStreaming ? 'not-allowed' : 'pointer',
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    opacity: isStreaming ? 0.5 : 1,
                  }}
                >
                  Continue generation
                </button>
              </div>
            )}
            {finishWarning && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  alignSelf: 'stretch',
                  padding: '8px 12px',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  borderRadius: 12,
                  background: 'color-mix(in oklab, var(--accent, currentColor) 9%, transparent)',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    opacity: 0.7,
                    marginBottom: 4,
                  }}
                >
                  {finishWarning.reason === 'length' ? 'Output truncated' : 'Step budget exhausted'}
                </div>
                {finishWarning.message}
              </div>
            )}
            {compactionAnnotation && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  fontSize: 12,
                  opacity: 0.55,
                }}
                title={
                  `Auto-compacted ${compactionAnnotation.compactedCount} older turns ` +
                  `(${compactionAnnotation.beforeTokens} → ${compactionAnnotation.afterTokens} tokens). ` +
                  'Older messages still appear in your transcript but are summarised when sent to the model.'
                }
              >
                Auto-compacted {compactionAnnotation.compactedCount} earlier turns
              </div>
            )}
            {turnFiles.length > 0 && <DownloadStrip files={turnFiles} autoOpen={isLastMessage && streamedHere} />}
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
    // ── Top-level recovery banner ───────────────────────────────��────
    // Two cut-off modes that are NOT covered by the per-message
    // continue button (which only fires when an assistant message
    // already exists with a stuck tool / empty body):
    //   1. `chat.error` is set — server returned a 4xx/5xx, or
    //      streamText threw and our route's `onError` reduced it to
    //      a string that ended up here.
    //   2. The last message in the transcript is a USER message and
    //      the stream is no longer in flight — the model never even
    //      started producing an assistant reply. This is the symptom
    //      the user reported when generating PPTX: "composing
    //      disappears, python window stops, app says nothing".
    // Both render as a single Retry banner that calls
    // `useChat.reload()` — that re-sends the last user message with
    // full prior history attached, so partial work (e.g. slide 1
    // already produced) stays in context and the model resumes
    // instead of restarting from scratch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msgArr = messages as any[]
    const lastMsg = msgArr.length > 0 ? msgArr[msgArr.length - 1] : null
    const lastWasUserOrphan =
      !!lastMsg && lastMsg.role === 'user' && !isStreaming && msgArr.length > 0
    const hasError = !!chatError
    // If our auto-fallback effect just fired for this exact user
    // message, skip rendering the rate-limit banner entirely — a
    // new request is already in flight against the fallback model
    // and will either clear `chatError` (success) or set a NEW
    // error keyed to a fresh dedup state (Haiku also 429ed, in
    // which case the next render WILL show the banner because
    // `lastAutoFallbackUserMsgIdRef.current === lastMsg.id` blocks
    // a second auto-switch, the `autoFallbackPendingForMsgId` flag
    // clears once that retry's stream begins, and the manual
    // banner takes over from there).
    const isAutoFallbackPendingThisTurn =
      hasError &&
      !!lastMsg &&
      lastMsg.role === 'user' &&
      autoFallbackPendingForMsgId === lastMsg.id
    if ((hasError || lastWasUserOrphan) && !isAutoFallbackPendingThisTurn) {
      // ── Error categorisation ───────────────────────────────────────
      // Anthropic / OpenAI / Google all phrase their errors very
      // differently and stuff multi-paragraph rate-limit copy into
      // the message. Showing the raw text in the chat surface is
      // intimidating and the actionable fix isn't obvious. We bucket
      // the error into a kind so the banner can render a one-line
      // summary and the right recovery button.
      //
      // Buckets:
      //   rate_limit  → 429 / "rate limit" / "TPM" / "tokens per minute"
      //   overloaded  → "overloaded" / "529" — provider capacity hiccup
      //   timeout     → request exceeded our maxDuration / model wall-clock
      //   no_response → no chatError but the assistant turn is missing
      //   generic     → anything else; we show the raw message
      const rawMessage = (() => {
        if (!chatError) return ''
        let text: string
        if (chatError instanceof Error) text = chatError.message
        else {
          try { text = String((chatError as { message?: unknown })?.message ?? chatError) }
          catch { return 'Unknown error' }
        }
        // Our own routes answer with `{ error: "…" }` (sign-in, credit,
        // budget) — show the sentence, not the JSON.
        try {
          const parsed = JSON.parse(text)
          if (parsed && typeof parsed.error === 'string') return parsed.error
        } catch { /* plain text */ }
        return text
      })()
      const lower = rawMessage.toLowerCase()
      const errorKind: 'rate_limit' | 'overloaded' | 'timeout' | 'no_response' | 'missing_tool' | 'generic' =
        !chatError                                                ? 'no_response'
        : /unavailable tool|no such tool|nosuchtool/i.test(lower) ? 'missing_tool'
        : /rate.?limit|429|tokens? per (minute|second)|tpm|exceed/i.test(lower) ? 'rate_limit'
        : /overload|529|temporarily unavailable|service unavail/i.test(lower)   ? 'overloaded'
        : /timeout|timed out|aborted|deadline/i.test(lower)       ? 'timeout'
        : 'generic'

      // Pick a sensible ALTERNATE model to suggest after a rate-limit
      // or overload. The previous code hardcoded "Sonnet 4.6" — which
      // produced the absurd "Sonnet hit its limit, retry on Sonnet"
      // banner the user complained about. The picker now reads:
      //
      //   - Same-family escalation when it actually helps:
      //       Opus  → Sonnet  (~8x TPM, same provider, same skills)
      //       Sonnet → Haiku  (cheaper / faster within Claude)
      //   - Cross-provider escape for everything else, defaulting to
      //     Gemini 2.5 Flash because it has the highest published
      //     TPM ceiling (1M+) and zero cold-start tax via the AI
      //     Gateway. The exception is when the user is already on
      //     Google — then we hop to GPT-4o.
      //
      // The picker returns null when there's no good alternate (e.g.
      // user is already on the recommended fallback), in which case
      // we hide the swap button entirely and show only "Retry on
      // <same model>" + the wait-60s advice.
      const alternateModel = (() => {
        const id = selectedTextModel.id
        if (/^anthropic\/claude-opus/.test(id)) {
          return TEXT_MODELS.find(m => m.id === 'anthropic/claude-sonnet-4.6') ?? null
        }
        if (/^anthropic\/claude-sonnet/.test(id)) {
          return TEXT_MODELS.find(m => m.id === 'anthropic/claude-haiku-4.5') ?? null
        }
        // Already on Google → escape to OpenAI rather than recommend
        // the same family.
        if (selectedTextModel.provider === 'google') {
          return TEXT_MODELS.find(m => m.id === 'openai/gpt-5-mini') ?? null
        }
        // Already on the high-quota fallback → no swap to suggest.
        if (id === 'google/gemini-2.5-flash') return null
        return TEXT_MODELS.find(m => m.id === 'google/gemini-2.5-flash') ?? null
      })()

      // Friendly one-liner per kind. References the picked alternate
      // by name when one exists, so the copy and the button always
      // agree. The raw provider text is appended (collapsed) for
      // debugging.
      const friendly = (() => {
        switch (errorKind) {
          case 'rate_limit':
            if (alternateModel) {
              return `${selectedTextModel.name} hit its per-minute rate limit. ` +
                     `${alternateModel.brandName} ${alternateModel.name} has a much higher quota ` +
                     'and works just as well for most tasks (slides, code, analysis). ' +
                     'Switch & retry, or wait ~60s and retry on the same model.'
            }
            return `${selectedTextModel.name} hit its per-minute rate limit. ` +
                   'Wait ~60s and retry, or pick a different model from the ' +
                   'composer dropdown. You\'re already on the highest-TPM model ' +
                   'we know about, so a cross-provider hop usually doesn\'t help here.'
          case 'overloaded':
            if (alternateModel) {
              return `${selectedTextModel.name} is temporarily overloaded on the provider side. ` +
                     `Retrying usually works within a minute. Switching to ${alternateModel.brandName} ` +
                     `${alternateModel.name} bypasses provider-specific capacity issues entirely.`
            }
            return `${selectedTextModel.name} is temporarily overloaded on the provider side. ` +
                   'Retrying usually works within a minute.'
          case 'timeout':
            return 'The request timed out before the model finished. ' +
                   'For long deliverables (PPTX, multi-page PDFs), break the work into ' +
                   'smaller follow-up turns instead of one big request.'
          case 'missing_tool':
            return 'Omma tried to run code to rebuild the file, but the code tools were not attached to that message. ' +
                   'This was a Omma problem, not the model. It is fixed now: try again and the same request will run.'
          case 'no_response':
            return 'The model stopped without producing a response. ' +
                   'This usually means the request timed out, hit the token limit, ' +
                   'or the provider returned an error mid-stream.'
          case 'generic':
          default:
            return rawMessage || 'The model returned an error.'
        }
      })()

      // Show the swap button only when there's actually a different
      // model to swap to AND the error is the kind a swap fixes.
      const canSuggestSwap =
        (errorKind === 'rate_limit' || errorKind === 'overloaded') &&
        alternateModel != null

      base.push({
        id: 'recovery-banner',
        who: 'ai' as const,
        time: timestamp(Date.now()),
        model: shortName(selectedModel.version, selectedModel.name),
        body: (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: '10px 12px',
            border: '1px solid var(--accent, #b00020)',
            borderRadius: 2,
            fontSize: 12,
          }}>
            <div style={{
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              opacity: 0.85,
            }}>
              {errorKind === 'rate_limit' ? 'Rate limited' :
               errorKind === 'overloaded' ? 'Provider overloaded' :
               errorKind === 'timeout'    ? 'Request timed out' :
               errorKind === 'no_response' ? 'No response' :
               errorKind === 'missing_tool' ? 'Tools not attached' :
               'Stream error'}
            </div>
            <div style={{ opacity: 0.85 }}>
              {friendly}
            </div>
            {/* Raw provider text — kept available for debugging
                but visually de-emphasised so it doesn't crowd the
                actionable copy above. */}
            {errorKind !== 'generic' && errorKind !== 'no_response' && rawMessage && (
              <details style={{ opacity: 0.55, fontSize: 10, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                <summary style={{ cursor: 'pointer' }}>Provider details</summary>
                <div style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>{rawMessage}</div>
              </details>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canSuggestSwap && alternateModel && (
                <button
                  type="button"
                  onClick={() => {
                    // Switch the picker UI to the alternate model so
                    // future turns also use it, and hand reload() an
                    // explicit body override so the first re-attempt
                    // doesn't race React state.
                    setSelectedTextModel(alternateModel)

                    // CRITICAL: rewrite the head of pendingModelRef so
                    // when this retry's `onFinish` fires it stamps the
                    // assistant message with the ACTUAL responding
                    // model. Without this, the original send's label
                    // (e.g. "Sonnet 4.6", queued at submit-time and
                    // never popped because the request errored) sits
                    // stale at the head of the FIFO and gets popped by
                    // the retry's onFinish — which is why retries on
                    // GPT-4o were rendering with a Sonnet 4.6 byline.
                    const altLabel = shortName(alternateModel.version, alternateModel.name)
                    if (pendingModelRef.current.length > 0) {
                      pendingModelRef.current[0] = altLabel
                    } else {
                      pendingModelRef.current.push(altLabel)
                    }

                    try {
                      chatReload?.({
                        body: {
                          model: alternateModel.id,
                          provider: alternateModel.provider,
                          systemPrompt: composedSystemPrompt,
                          temperature,
                          maxTokens,
                          params: textParams,
                          tools: enabledToolIds,
                        },
                      })
                    } catch (e) {
                      console.error('[v0] swap-and-retry failed', e)
                    }
                  }}
                  disabled={isStreaming}
                  style={{
                    padding: '4px 12px',
                    // Use the theme's `--foreground` for the slab and
                    // `--bg` for the label. This guarantees contrast in
                    // BOTH light and dark palettes:
                    //   light → dark slab, near-white label
                    //   dark  → cream slab, dark label
                    // The earlier `background: currentColor` +
                    // `color: var(--paper, #fff)` rendered as a totally
                    // invisible white-on-white button in dark mode
                    // because `--paper` doesn't exist as a token (so it
                    // always fell back to #fff) and `currentColor` is
                    // also near-white when dark-mode text is inherited.
                    border: '1px solid var(--foreground)',
                    borderRadius: 2,
                    background: 'var(--foreground)',
                    color: 'var(--bg)',
                    cursor: isStreaming ? 'not-allowed' : 'pointer',
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    opacity: isStreaming ? 0.5 : 1,
                  }}
                >
                  Switch to {alternateModel.brandName} {alternateModel.name} &amp; retry
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  // Plain reload — re-sends the last user message
                  // with full prior history attached, so any
                  // intermediate progress (e.g. slide 1 already
                  // generated) is still in context.
                  //
                  // Same FIFO fix as the swap button: rewrite the head
                  // of pendingModelRef to the CURRENTLY selected model
                  // so the retry's onFinish stamps the right byline,
                  // even if the user manually changed the picker
                  // between the original failed send and this retry.
                  const curLabel = shortName(selectedTextModel.version, selectedTextModel.name)
                  if (pendingModelRef.current.length > 0) {
                    pendingModelRef.current[0] = curLabel
                  } else {
                    pendingModelRef.current.push(curLabel)
                  }
                  try { chatReload?.() } catch (e) {
                    console.error('[v0] retry failed', e)
                  }
                }}
                disabled={isStreaming}
                style={{
                  padding: '4px 12px',
                  border: '1px solid currentColor',
                  borderRadius: 2,
                  background: 'transparent',
                  color: 'inherit',
                  cursor: isStreaming ? 'not-allowed' : 'pointer',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  opacity: isStreaming ? 0.5 : 1,
                }}
              >
                {canSuggestSwap ? `Retry on ${selectedTextModel.name}` : 'Try again'}
              </button>
            </div>
          </div>
        ),
      })
    }
    return base
  }, [
    messages, selectedModel.version, selectedModel.name,
    chatError, isStreaming, chatReload,
    selectedTextModel, setSelectedTextModel,
    composedSystemPrompt, temperature, maxTokens,
    textParams, enabledToolIds,
  ])

  const nav: RailNavItem[] = [
    { id: 'projects', label: 'Projects', icon: I.proj, onClick: () => router.push('/projects') },
    { id: 'chats', label: 'Chats', icon: I.chats, count: recentChats.length, active: true },
    { id: 'history', label: 'History', icon: I.hist, onClick: () => router.push('/history') },
    { id: 'files', label: 'Files', icon: I.files, onClick: () => router.push('/files') },
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
      markSignedOut()
      await supabase.auth.signOut()
    } catch (e) {
      console.error('[v0] sign-out error:', e)
    }
    if (typeof window !== 'undefined') window.location.href = '/login'
  }

  async function handleDeleteAccount() {
    const ok = typeof window !== 'undefined'
      && window.confirm('Permanently delete your Omma account? This cannot be undone.')
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
          title: topTitle || 'Omma conversation',
          text: 'Conversation from Omma',
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

  /* ----- user identity (live profile from Supabase) -----------------
   *
   * Loaded on mount AND re-fetched whenever any surface dispatches
   * `clox-profile-changed` (same-tab) or bumps the `clox.profile.tick`
   * sentinel in localStorage (cross-tab). /settings dispatches both
   * after a successful profile save / avatar regenerate. Without
   * these listeners — AND without selecting `avatar_seed` — the
   * /text rail-footer would render the letter-fallback Avatar
   * forever, even though every other surface (history, gallery,
   * /settings itself, the AppLayout-wrapped pages) already shows
   * the saved Dicebear avatar correctly. That asymmetry was the
   * "my avatar is the first letter on /text but not anywhere else"
   * bug the user kept hitting.
   *
   * `avatarSeed` defaults to the auth email when the profile row
   * doesn't have one yet, matching the contract `useChatChrome`
   * uses on every other surface — so a fresh sign-up still gets a
   * deterministic Dicebear avatar instead of the letter fallback.
   */
  const [user, setUser] = useState<{
    initial: string
    name: string
    plan: string
    email?: string
    avatarSeed?: string
  }>(() => cachedIdentity()?.user ?? SIGNED_OUT_USER)
  const [isSuperAdmin, setIsSuperAdmin] = useState(() => cachedIdentity()?.isSuperAdmin ?? false)

  useEffect(() => {
    const stop = watchIdentity(identity => {
      setUser(identity.user)
      setIsSuperAdmin(identity.isSuperAdmin)
    })
    return () => {
      stop()
    }
  }, [])

  /* ── Live input-token meter ─────────────────────────────────────────
   *
   * What we count, and why those numbers
   *
   *   PREAMBLE_FLOOR     — the Omma capabilities preamble lives in
   *                        the route handler (server-side), so the
   *                        client never sees the exact text. We hard-
   *                        code its approximate size in tokens. After
   *                        the recent trim it's ~700-900 tokens; we
   *                        round up to 900 for a safe estimate. On
   *                        Anthropic the preamble is now in the
   *                        cacheable prefix (Phase 1a) so the SECOND
   *                        and later turns of a chat won't actually
   *                        spend this against TPM — but the meter
   *                        shows the worst-case (turn-1) cost so the
   *                        user can correlate it with rate-limit
   *                        errors when they hit them.
   *   sys                — user-saved persistent system prompt + any
   *                        per-turn auto-detect skill prose. Both vary
   *                        per request and are NOT in the cache prefix.
   *   history            — every prior user/assistant turn in this
   *                        chat. Grows linearly until Phase-3
   *                        compaction kicks in.
   *   draft              — what the user is typing right now.
   *
   * The meter renders alongside the existing `tokens · <cost>` slot in
   * the composer toolbar (`ChatWorkspace.tokenEstimate`). The "cost"
   * string is repurposed as a colour-coded headroom indicator
   * relative to the SELECTED MODEL's per-minute input cap — which is
   * the actual constraint that matters for the rate-limit bug. We
   * don't claim dollar costs because they vary per provider tier and
   * we don't track real usage on the client.
   */
  const tokenEstimate = useMemo(() => {
    const PREAMBLE_FLOOR = 900
    const sys = estimateTokensForString(systemPrompt)
    const history = estimateTokensForMessages(messages as unknown[])
    const draft = estimateTokensForString(input)
    const tokens = PREAMBLE_FLOOR + sys + history + draft

    // Per-model input TPM caps for tier-1 / commonly-provisioned
    // accounts. These are the published Anthropic / OpenAI / Google
    // defaults; users on higher tiers will simply see the meter say
    // "near limit" earlier than reality, which fails safe.
    const tpmCap: number = (() => {
      const id = selectedTextModel.id.toLowerCase()
      if (id.includes('opus'))     return 10_000
      if (id.includes('sonnet'))   return 80_000
      if (id.includes('haiku'))    return 100_000
      if (id.includes('gpt-5'))    return 30_000
      if (id.includes('gpt-4'))    return 30_000
      if (id.includes('o1') || id.includes('o3')) return 30_000
      if (id.includes('gemini'))   return 1_000_000
      if (id.includes('grok'))     return 60_000
      return 50_000
    })()
    const pct = Math.round((tokens / tpmCap) * 100)
    const headroom =
      pct < 50  ? `~${pct}% of ${formatTokenCount(tpmCap)} cap` :
      pct < 80  ? `~${pct}% of cap — getting heavy` :
      pct < 100 ? `~${pct}% of cap — near rate-limit` :
                  `over cap — will likely hit rate-limit`
    return { tokens, cost: headroom }
  }, [systemPrompt, messages, input, selectedTextModel.id])

  return (
    <WorkspaceSlot
        theme={theme}
        variant="chip"
        brandName="Omma"
        user={user}
        onOpenSettings={() => router.push('/settings')}
        onChangeTheme={handleThemeChange}
        language={language}
        onChangeLanguage={handleChangeLanguage}
        onOpenSuperAdmin={isSuperAdmin ? () => router.push('/admin') : undefined}
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
        tokenEstimate={tokenEstimate}
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
