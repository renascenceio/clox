'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar from '@/shared/ui/layout/ChatSidebar'
import UnifiedControlsPanel from '@/shared/ui/layout/UnifiedControlsPanel'
import MediaComposer from '@/shared/ui/layout/MediaComposer'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'
import { AUDIO_MODELS, AUDIO_DURATIONS, AUDIO_QUALITY } from '@/domains/audio-generation/services/audio-models'
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

interface AudioClip {
  id: string
  url: string
  prompt: string
  brand: string
  version: string
  duration: number
  createdAt: number
}

const GALLERY_KEY = 'clox_audio_gallery'

export default function AudioPage() {
  const availableModels = useAvailableModels(AUDIO_MODELS)
  const [selectedModel, setSelectedModel] = useState<typeof AUDIO_MODELS[number]>(availableModels[0] ?? AUDIO_MODELS[0])
  const [selectedDuration, setSelectedDuration] = useState(30)
  const [selectedQuality, setSelectedQuality] = useState('high')
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [audios, setAudios] = useState<AudioClip[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null)

  useEffect(() => {
    if (!availableModels.find(m => m.id === selectedModel.id) && availableModels[0]) {
      setSelectedModel(availableModels[0])
    }
  }, [availableModels, selectedModel.id])

  useEffect(() => {
    const id = getActiveChatId('audio')
    setActiveChatIdState(id)
    setAudios(loadHistory<AudioClip>('audio', id))
  }, [])

  const handleChatSelect = (chatId: string) => {
    setActiveChatIdState(chatId)
    persistActiveChatId('audio', chatId)
    setAudios(loadHistory<AudioClip>('audio', chatId))
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return

    const chat = ensureActiveChat('audio', prompt, selectedModel.brandName)
    if (chat.id !== activeChatId) {
      setActiveChatIdState(chat.id)
      persistActiveChatId('audio', chat.id)
    } else {
      touchChat(chat.id, { model: selectedModel.brandName })
    }

    setErrorMessage('')
    setIsGenerating(true)
    setStatusText(`${selectedModel.brandName} is preparing your audio…`)

    const stages = [
      { delay: 600, text: `${selectedModel.brandName} is analysing the brief…` },
      { delay: 1400, text: `Synthesising ${selectedModel.type === 'music' ? 'music' : 'voice'} with ${selectedModel.version}…` },
      { delay: 2200, text: 'Mastering audio…' },
    ]
    const timers = stages.map(s => setTimeout(() => setStatusText(s.text), s.delay))

    try {
      const clientApiKey = getProviderApiKey(selectedModel.provider)
      const res = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: selectedModel.id,
          apiKey: clientApiKey || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Audio generation failed (${res.status})`)
      }

      const clip: AudioClip = {
        id: Date.now().toString(),
        url: data.url,
        prompt,
        brand: selectedModel.brandName,
        version: selectedModel.version || selectedModel.name,
        duration: Math.round(data.durationSec ?? selectedDuration),
        createdAt: Date.now(),
      }
      setAudios(prev => {
        const next = [clip, ...prev]
        saveHistory('audio', chat.id, next)
        return next
      })
      setPrompt('')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Audio generation failed')
    } finally {
      timers.forEach(clearTimeout)
      setIsGenerating(false)
      setStatusText('')
    }
  }

  const handleSaveToGallery = (clip: AudioClip) => {
    const raw = localStorage.getItem(GALLERY_KEY)
    const existing = raw ? JSON.parse(raw) as AudioClip[] : []
    localStorage.setItem(GALLERY_KEY, JSON.stringify([clip, ...existing]))
    setStatusText('saved')
    setTimeout(() => setStatusText(''), 1500)
  }

  const handleRefine = (clip: AudioClip) => {
    setPrompt(clip.prompt)
    setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea')?.focus(), 50)
  }

  const settingsPanel = (
    <UnifiedControlsPanel
      type="audio"
      models={availableModels}
      selectedModel={selectedModel}
      onModelChange={(model) => setSelectedModel(model as typeof AUDIO_MODELS[number])}
      durations={AUDIO_DURATIONS}
      selectedDuration={selectedDuration}
      onDurationChange={setSelectedDuration}
      qualityLevels={AUDIO_QUALITY}
      selectedQuality={selectedQuality}
      onQualityChange={setSelectedQuality}
    />
  )

  const sidebar = (
    <ChatSidebar modality="audio" activeChatId={activeChatId ?? undefined} onChatSelect={handleChatSelect} />
  )

  const topTitle =
    audios.length > 0
      ? audios[0].prompt.split('\n')[0].slice(0, 64)
      : 'New track'

  return (
    <AppLayout sidebar={sidebar} rightPanel={settingsPanel}>
      <header className="flex items-center justify-between px-8 pt-5 pb-4 border-b border-hairline-soft">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">
            audio · {selectedModel.brandName.toLowerCase()}
          </div>
          <h1 className="font-serif italic text-[26px] leading-tight tracking-[-0.005em] text-ink truncate mt-1">
            {topTitle}
          </h1>
        </div>
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted hidden md:inline">
          {selectedDuration}s · {selectedQuality}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[820px] mx-auto px-8 pt-8 pb-[260px] space-y-6">

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
                {selectedModel.brandName.toLowerCase()} · {selectedModel.version} · {selectedDuration}s · {selectedQuality}
              </div>
            </motion.div>
          )}

          {audios.length === 0 && !isGenerating && (
            <div className="text-center py-24">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted mb-4">begin</div>
              <h2 className="font-serif italic text-[40px] leading-[1.1] tracking-[-0.01em] text-ink max-w-[520px] mx-auto">
                A line spoken. A theme played. A sound made.
              </h2>
            </div>
          )}

          <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-4">
            <AnimatePresence>
              {audios.map((a, idx) => (
                <motion.figure
                  key={a.id}
                  variants={cardVariant}
                  className="bg-surface border border-hairline px-5 py-4"
                >
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                      №{String(audios.length - idx).padStart(3, '0')}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                      {a.brand.toLowerCase()} · {a.version.toLowerCase()} · {a.duration}s
                    </span>
                  </div>
                  <p className="font-serif italic text-[15px] leading-[1.4] text-ink mb-3 line-clamp-2">
                    {a.prompt}
                  </p>
                  <audio src={a.url} controls className="w-full" />
                  <div className="mt-3 flex">
                    <button
                      onClick={() => handleRefine(a)}
                      className="flex-1 h-8 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft hover:text-ink hover:bg-rail-soft border-r border-hairline-soft transition-colors"
                    >
                      refine
                    </button>
                    <button
                      onClick={() => handleSaveToGallery(a)}
                      className="flex-1 h-8 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft hover:text-ink hover:bg-rail-soft border-r border-hairline-soft transition-colors"
                    >
                      save
                    </button>
                    <a
                      href={a.url}
                      download
                      className="flex-1 h-8 inline-flex items-center justify-center font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft hover:text-ink hover:bg-rail-soft transition-colors"
                    >
                      download ↓
                    </a>
                  </div>
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
        activeType="audio"
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={handleGenerate}
        isGenerating={isGenerating}
        meta={[
          (selectedModel.version || selectedModel.name).toLowerCase(),
          `${selectedDuration}s`,
          selectedQuality,
        ]}
        placeholder="A line to speak. A theme to play. A sound to make."
      />
    </AppLayout>
  )
}
