'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar from '@/shared/ui/layout/ChatSidebar'
import UnifiedControlsPanel from '@/shared/ui/layout/UnifiedControlsPanel'
import MediaComposer from '@/shared/ui/layout/MediaComposer'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'
import { VIDEO_MODELS, VIDEO_ASPECT_RATIOS, VIDEO_DURATIONS } from '@/domains/video-generation/services/video-models'
import { useAvailableModels } from '@/lib/use-available-models'
import { getProviderApiKey } from '@/lib/admin-settings'
import {
  getActiveChatId,
  setActiveChatId as persistActiveChatId,
  ensureActiveChat,
  touchChat,
  loadHistory,
  saveHistory,
} from '@/lib/chat-store'

interface VideoClip {
  id: string
  url: string
  prompt: string
  brand: string
  version: string
  ratio: string
  duration: number
  createdAt: number
}

const GALLERY_KEY = 'clox_video_gallery'

export default function VideoPage() {
  const availableModels = useAvailableModels(VIDEO_MODELS)
  const [selectedModel, setSelectedModel] = useState<typeof VIDEO_MODELS[number]>(availableModels[0] ?? VIDEO_MODELS[0])
  const [selectedRatio, setSelectedRatio] = useState('16:9')
  const [selectedDuration, setSelectedDuration] = useState(5)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [videos, setVideos] = useState<VideoClip[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null)

  useEffect(() => {
    if (!availableModels.find(m => m.id === selectedModel.id) && availableModels[0]) {
      setSelectedModel(availableModels[0])
    }
  }, [availableModels, selectedModel.id])

  useEffect(() => {
    const id = getActiveChatId('video')
    setActiveChatIdState(id)
    setVideos(loadHistory<VideoClip>('video', id))
  }, [])

  const handleChatSelect = (chatId: string) => {
    setActiveChatIdState(chatId)
    persistActiveChatId('video', chatId)
    setVideos(loadHistory<VideoClip>('video', chatId))
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return

    const chat = ensureActiveChat('video', prompt, selectedModel.brandName)
    if (chat.id !== activeChatId) {
      setActiveChatIdState(chat.id)
      persistActiveChatId('video', chat.id)
    } else {
      touchChat(chat.id, { model: selectedModel.brandName })
    }

    setErrorMessage('')
    setIsGenerating(true)
    setStatusText(`${selectedModel.brandName} is preparing your video…`)

    const stages = [
      { delay: 800, text: `${selectedModel.brandName} is interpreting the prompt…` },
      { delay: 2000, text: `Rendering frames with ${selectedModel.version}…` },
      { delay: 3600, text: 'Assembling clip…' },
    ]
    const timers = stages.map(s => setTimeout(() => setStatusText(s.text), s.delay))

    try {
      const clientApiKey = getProviderApiKey(selectedModel.provider)
      const res = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: selectedModel.id,
          ratio: selectedRatio,
          duration: selectedDuration,
          apiKey: clientApiKey || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Video generation failed (${res.status})`)
      }

      const clip: VideoClip = {
        id: Date.now().toString(),
        url: data.url,
        prompt,
        brand: selectedModel.brandName,
        version: selectedModel.version || selectedModel.name,
        ratio: selectedRatio,
        duration: selectedDuration,
        createdAt: Date.now(),
      }
      setVideos(prev => {
        const next = [clip, ...prev]
        saveHistory('video', chat.id, next)
        return next
      })
      setPrompt('')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Video generation failed')
    } finally {
      timers.forEach(clearTimeout)
      setIsGenerating(false)
      setStatusText('')
    }
  }

  const handleSaveToGallery = (clip: VideoClip) => {
    const raw = localStorage.getItem(GALLERY_KEY)
    const existing = raw ? JSON.parse(raw) as VideoClip[] : []
    localStorage.setItem(GALLERY_KEY, JSON.stringify([clip, ...existing]))
    setStatusText('saved')
    setTimeout(() => setStatusText(''), 1500)
  }

  const handleRefine = (clip: VideoClip) => {
    setPrompt(clip.prompt)
    setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea')?.focus(), 50)
  }

  const settingsPanel = (
    <UnifiedControlsPanel
      type="video"
      models={availableModels}
      selectedModel={selectedModel}
      onModelChange={(model) => setSelectedModel(model as typeof VIDEO_MODELS[number])}
      aspectRatios={VIDEO_ASPECT_RATIOS}
      selectedAspectRatio={selectedRatio}
      onAspectRatioChange={setSelectedRatio}
      durations={VIDEO_DURATIONS}
      selectedDuration={selectedDuration}
      onDurationChange={setSelectedDuration}
    />
  )

  const sidebar = (
    <ChatSidebar
      modality="video"
      activeChatId={activeChatId ?? undefined}
      onChatSelect={handleChatSelect}
    />
  )

  const topTitle =
    videos.length > 0
      ? videos[0].prompt.split('\n')[0].slice(0, 64)
      : 'New reel'

  return (
    <AppLayout sidebar={sidebar} rightPanel={settingsPanel}>
      {/* Top strip */}
      <header className="flex items-center justify-between px-8 pt-5 pb-4 border-b border-hairline-soft">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">
            video · {selectedModel.brandName.toLowerCase()}
          </div>
          <h1 className="font-serif italic text-[26px] leading-tight tracking-[-0.005em] text-ink truncate mt-1">
            {topTitle}
          </h1>
        </div>
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted hidden md:inline">
          {selectedRatio} · {selectedDuration}s
        </span>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1080px] mx-auto px-8 pt-8 pb-[260px] space-y-6">

          {errorMessage && (
            <div className="px-4 py-3 border border-hairline bg-surface-alt rounded-sharp flex items-center gap-3">
              <span className="font-mono text-[10px] tracking-[0.04em] uppercase text-accent">error</span>
              <p className="flex-1 text-[13px] text-ink">{errorMessage}</p>
              <button onClick={() => setErrorMessage('')} className="font-mono text-[11px] text-ink-muted hover:text-ink">×</button>
            </div>
          )}

          {isGenerating && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="bg-surface border border-hairline rounded-card px-5 py-4">
              <div className="flex items-baseline gap-3">
                <span className="font-serif italic text-[15px] text-accent">Clox</span>
                <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                  {statusText || `${selectedModel.brandName.toLowerCase()} is composing`}
                  <span className="ml-1 inline-flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-ink-muted animate-pulse" />
                    <span className="w-1 h-1 rounded-full bg-ink-muted animate-pulse" style={{ animationDelay: '120ms' }} />
                    <span className="w-1 h-1 rounded-full bg-ink-muted animate-pulse" style={{ animationDelay: '240ms' }} />
                  </span>
                </span>
              </div>
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted mt-2">
                {selectedModel.brandName.toLowerCase()} · {selectedModel.version} · {selectedRatio} · {selectedDuration}s
              </div>
            </motion.div>
          )}

          {videos.length === 0 && !isGenerating && (
            <div className="text-center py-24">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted mb-4">begin</div>
              <h2 className="font-serif italic text-[40px] leading-[1.1] tracking-[-0.01em] text-ink max-w-[520px] mx-auto">
                Describe a scene the world hasn&apos;t filmed yet.
              </h2>
            </div>
          )}

          <motion.div variants={stagger} initial="initial" animate="animate"
            className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AnimatePresence>
              {videos.map((v, idx) => (
                <motion.figure
                  key={v.id}
                  variants={cardVariant}
                  className="bg-surface border border-hairline overflow-hidden"
                >
                  <video src={v.url} controls className="w-full aspect-video bg-ink" />
                  <figcaption className="px-4 py-3 border-t border-hairline-soft">
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                        №{String(videos.length - idx).padStart(3, '0')}
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                        {v.brand.toLowerCase()} · {v.version.toLowerCase()} · {v.ratio} · {v.duration}s
                      </span>
                    </div>
                    <p className="font-serif italic text-[14px] leading-[1.4] text-ink line-clamp-2">
                      {v.prompt}
                    </p>
                    <div className="mt-3 flex">
                      <button
                        onClick={() => handleRefine(v)}
                        className="flex-1 h-8 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft hover:text-ink hover:bg-rail-soft border-r border-hairline-soft transition-colors"
                      >
                        refine
                      </button>
                      <button
                        onClick={() => handleSaveToGallery(v)}
                        className="flex-1 h-8 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft hover:text-ink hover:bg-rail-soft border-r border-hairline-soft transition-colors"
                      >
                        save
                      </button>
                      <a
                        href={v.url}
                        download
                        className="flex-1 h-8 inline-flex items-center justify-center font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft hover:text-ink hover:bg-rail-soft transition-colors"
                      >
                        download ↓
                      </a>
                    </div>
                  </figcaption>
                </motion.figure>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {statusText && !isGenerating && (
        <div className="absolute top-20 right-8 px-3 h-7 inline-flex items-center bg-ink text-bg font-mono text-[10px] tracking-[0.18em] uppercase z-40">
          {statusText}
        </div>
      )}

      <MediaComposer
        activeType="video"
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={handleGenerate}
        isGenerating={isGenerating}
        meta={[
          (selectedModel.version || selectedModel.name).toLowerCase(),
          selectedRatio,
          `${selectedDuration}s`,
        ]}
        placeholder="A scene. A motion. A long take."
      />
    </AppLayout>
  )
}
