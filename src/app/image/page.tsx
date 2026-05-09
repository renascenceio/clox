'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar from '@/shared/ui/layout/ChatSidebar'
import UnifiedControlsPanel from '@/shared/ui/layout/UnifiedControlsPanel'
import MediaComposer from '@/shared/ui/layout/MediaComposer'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { IMAGE_MODELS, ASPECT_RATIOS, QUALITY_LEVELS, STYLE_PRESETS } from '@/domains/image-generation/services/image-models'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'
import Image from 'next/image'
import { useAvailableModels } from '@/lib/use-available-models'
import {
  getActiveChatId,
  setActiveChatId as persistActiveChatId,
  ensureActiveChat,
  touchChat,
  loadHistory,
  saveHistory,
} from '@/lib/chat-store'

interface Generation {
  id: string
  url: string
  prompt: string
  model: string
  ratio: string
}

export default function ImagePage() {
  const availableModels = useAvailableModels(IMAGE_MODELS)
  const [selectedModel, setSelectedModel] = useState<typeof IMAGE_MODELS[number]>(availableModels[0] ?? IMAGE_MODELS[0])

  useEffect(() => {
    if (!availableModels.find(m => m.id === selectedModel.id) && availableModels[0]) {
      setSelectedModel(availableModels[0])
    }
  }, [availableModels, selectedModel.id])

  const [selectedRatio, setSelectedRatio] = useState('1:1')
  const [selectedQuality, setSelectedQuality] = useState('hd')
  const [selectedStyle, setSelectedStyle] = useState('photorealistic')
  const [prompt, setPrompt] = useState('')
  const [generations, setGenerations] = useState<Generation[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [activeChatId, setActiveChatIdState] = useState<string | null>(null)

  useEffect(() => {
    const id = getActiveChatId('image')
    setActiveChatIdState(id)
    setGenerations(loadHistory<Generation>('image', id))
  }, [])

  const handleChatSelect = (chatId: string) => {
    setActiveChatIdState(chatId)
    persistActiveChatId('image', chatId)
    setGenerations(loadHistory<Generation>('image', chatId))
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return

    const chat = ensureActiveChat('image', prompt, selectedModel.brandName)
    if (chat.id !== activeChatId) {
      setActiveChatIdState(chat.id)
      persistActiveChatId('image', chat.id)
    } else {
      touchChat(chat.id, { model: selectedModel.brandName })
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: selectedModel.id,
          ratio: selectedRatio,
          quality: selectedQuality,
          style: selectedStyle,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate image')
      }
      const next: Generation[] = [
        { id: Date.now().toString(), url: data.url, prompt, model: selectedModel.name, ratio: selectedRatio },
        ...generations,
      ]
      setGenerations(next)
      saveHistory('image', chat.id, next)
      setPrompt('')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate image')
    } finally {
      setIsGenerating(false)
    }
  }

  const settingsPanel = (
    <UnifiedControlsPanel
      type="image"
      models={availableModels}
      selectedModel={selectedModel}
      onModelChange={(model) => setSelectedModel(model as typeof IMAGE_MODELS[number])}
      aspectRatios={ASPECT_RATIOS}
      selectedAspectRatio={selectedRatio}
      onAspectRatioChange={setSelectedRatio}
      qualityLevels={QUALITY_LEVELS}
      selectedQuality={selectedQuality}
      onQualityChange={setSelectedQuality}
      stylePresets={STYLE_PRESETS}
      selectedStyle={selectedStyle}
      onStyleChange={setSelectedStyle}
    />
  )

  const sidebar = (
    <ChatSidebar modality="image" activeChatId={activeChatId ?? undefined} onChatSelect={handleChatSelect} />
  )

  const topTitle =
    generations.length > 0
      ? generations[0].prompt.split('\n')[0].slice(0, 64)
      : 'New canvas'

  return (
    <AppLayout sidebar={sidebar} rightPanel={settingsPanel}>
      {/* Top strip */}
      <header className="flex items-center justify-between px-8 pt-5 pb-4 border-b border-hairline-soft">
        <div className="min-w-0">
          <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted">
            image · {selectedModel.brandName.toLowerCase()}
          </div>
          <h1 className="font-serif italic text-[26px] leading-tight tracking-[-0.005em] text-ink truncate mt-1">
            {topTitle}
          </h1>
        </div>
        <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted hidden md:inline">
          {selectedRatio} · {selectedQuality} · {selectedStyle}
        </span>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-[1080px] mx-auto px-8 pt-8 pb-[260px]">

          {errorMessage && (
            <div className="mb-6 px-4 py-3 border border-hairline bg-surface-alt rounded-sharp flex items-center gap-3">
              <span className="font-mono text-[10px] tracking-[0.04em] uppercase text-accent">error</span>
              <p className="flex-1 text-[13px] text-ink">{errorMessage}</p>
              <button onClick={() => setErrorMessage('')} className="font-mono text-[11px] text-ink-muted hover:text-ink">×</button>
            </div>
          )}

          {isGenerating && (
            <div className="mb-6 flex items-baseline gap-3">
              <span className="font-serif italic text-[15px] text-accent">Clox</span>
              <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                {selectedModel.brandName.toLowerCase()} is composing
                <span className="ml-1 inline-flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-ink-muted animate-pulse" />
                  <span className="w-1 h-1 rounded-full bg-ink-muted animate-pulse" style={{ animationDelay: '120ms' }} />
                  <span className="w-1 h-1 rounded-full bg-ink-muted animate-pulse" style={{ animationDelay: '240ms' }} />
                </span>
              </span>
            </div>
          )}

          {generations.length === 0 && !isGenerating && (
            <div className="text-center py-24">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-ink-muted mb-4">begin</div>
              <h2 className="font-serif italic text-[40px] leading-[1.1] tracking-[-0.01em] text-ink max-w-[520px] mx-auto">
                Describe a still that doesn&apos;t yet exist.
              </h2>
              <p className="font-sans text-[14px] text-ink-soft mt-4">
                Press <span className="font-mono text-[12px] text-ink">⌘.</span> to configure
              </p>
            </div>
          )}

          {/* Gallery — flexible columns. Hairline frames, mono captions. */}
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]"
          >
            <AnimatePresence mode="popLayout">
              {generations.map((gen, idx) => (
                <motion.figure
                  key={gen.id}
                  variants={cardVariant}
                  layout
                  className="relative group break-inside-avoid mb-4 bg-surface border border-hairline overflow-hidden"
                >
                  <div className="relative aspect-square w-full bg-rail">
                    <Image src={gen.url} alt={gen.prompt} fill className="object-cover" />
                  </div>

                  <figcaption className="px-3 py-2.5 border-t border-hairline-soft">
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                        №{String(generations.length - idx).padStart(3, '0')}
                      </span>
                      <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted truncate">
                        {gen.model.toLowerCase()} · {gen.ratio}
                      </span>
                    </div>
                    <p className="font-serif italic text-[13px] leading-[1.4] text-ink line-clamp-2">
                      {gen.prompt}
                    </p>
                  </figcaption>

                  {/* Hover actions — paper sheet, hairline rule */}
                  <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform bg-surface border-t border-hairline">
                    <div className="flex">
                      <button
                        onClick={() => {
                          setPrompt(gen.prompt)
                          setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea')?.focus(), 50)
                        }}
                        className="flex-1 h-9 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft hover:text-ink hover:bg-rail-soft transition-colors border-r border-hairline-soft"
                      >
                        refine
                      </button>
                      <button
                        onClick={() => {
                          const raw = localStorage.getItem('clox_image_gallery')
                          const existing = raw ? JSON.parse(raw) : []
                          localStorage.setItem('clox_image_gallery', JSON.stringify([gen, ...existing]))
                        }}
                        className="flex-1 h-9 font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft hover:text-ink hover:bg-rail-soft transition-colors border-r border-hairline-soft"
                      >
                        save
                      </button>
                      <a
                        href={gen.url}
                        download
                        className="flex-1 h-9 inline-flex items-center justify-center font-mono text-[10px] tracking-[0.18em] uppercase text-ink-soft hover:text-ink hover:bg-rail-soft transition-colors"
                      >
                        download ↓
                      </a>
                    </div>
                  </div>
                </motion.figure>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Composer */}
      <MediaComposer
        activeType="image"
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={handleGenerate}
        isGenerating={isGenerating}
        meta={[
          (selectedModel.version || selectedModel.name).toLowerCase(),
          selectedRatio,
          selectedStyle,
        ]}
        placeholder="Describe a frame: a place, a mood, a fragment."
      />
    </AppLayout>
  )
}
