'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import UnifiedControlsPanel from '@/shared/ui/layout/UnifiedControlsPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'
import { VIDEO_MODELS, VIDEO_ASPECT_RATIOS, VIDEO_DURATIONS } from '@/domains/video-generation/services/video-models'
import { useRouter } from 'next/navigation'
import { useAvailableModels } from '@/lib/use-available-models'
import { getProviderApiKey } from '@/lib/admin-settings'

type AIType = 'text' | 'image' | 'video' | 'audio'

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
// Different fallback clips per provider so the user can visually distinguish
// which provider produced what even while the backend is mocked.
const PROVIDER_PLACEHOLDER: Record<string, string> = {
  openai: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  runway: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  luma: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  pika: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  haiper: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  stability: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  kuaishou: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
  zhipu: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  pixverse: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  shengshu: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
  heygen: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  synthesia: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4',
  did: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
}

export default function VideoPage() {
  const router = useRouter()
  const availableModels = useAvailableModels(VIDEO_MODELS)
  const [selectedModel, setSelectedModel] = useState<typeof VIDEO_MODELS[number]>(availableModels[0] ?? VIDEO_MODELS[0])
  const [selectedRatio, setSelectedRatio] = useState('16:9')
  const [selectedDuration, setSelectedDuration] = useState(5)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [videos, setVideos] = useState<VideoClip[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [activeAIType, setActiveAIType] = useState<AIType>('video')

  useEffect(() => {
    if (!availableModels.find(m => m.id === selectedModel.id) && availableModels[0]) {
      setSelectedModel(availableModels[0])
    }
  }, [availableModels, selectedModel.id])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return

    const apiKey = getProviderApiKey(selectedModel.provider)
    if (!apiKey) {
      setErrorMessage(`No API key found for ${selectedModel.brandName}. Add one in Super Admin → API Keys.`)
      return
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
      await new Promise(resolve => setTimeout(resolve, 5000))

      const url = PROVIDER_PLACEHOLDER[selectedModel.provider] || PROVIDER_PLACEHOLDER.runway

      const clip: VideoClip = {
        id: Date.now().toString(),
        url,
        prompt,
        brand: selectedModel.brandName,
        version: selectedModel.version || selectedModel.name,
        ratio: selectedRatio,
        duration: selectedDuration,
        createdAt: Date.now(),
      }
      setVideos(prev => [clip, ...prev])
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
    setStatusText('Saved to gallery')
    setTimeout(() => setStatusText(''), 1500)
  }

  const handleRefine = (clip: VideoClip) => {
    setPrompt(clip.prompt)
    setTimeout(() => document.querySelector<HTMLTextAreaElement>('textarea')?.focus(), 50)
  }

  const handleAITypeChange = (type: AIType) => {
    setActiveAIType(type)
    router.push(`/${type}`)
  }

  const aiTypeIcons = {
    text: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
    image: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
    video: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    audio: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
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
    <ChatSidebar>
      <SidebarItem id="tokyo-walk" title="Walking in Tokyo" active />
      <SidebarItem id="deep-sea" title="Deep sea exploration" />
    </ChatSidebar>
  )

  return (
    <AppLayout sidebar={sidebar} rightPanel={settingsPanel}>
      <div className="flex flex-col h-full max-w-6xl mx-auto px-4 pt-10 pb-48">
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-hig-lg flex items-center gap-3">
            <p className="flex-1 text-sm font-medium text-red-800 dark:text-red-200">{errorMessage}</p>
            <button onClick={() => setErrorMessage('')} className="text-red-600 dark:text-red-400">✕</button>
          </div>
        )}

        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
          {isGenerating && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 bg-surface dark:bg-surface-tertiary border border-separator rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-apple-teal flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-label-primary">
                    <span className="w-2 h-2 rounded-full bg-apple-teal animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-apple-teal animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-apple-teal animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="ml-1">{statusText || `${selectedModel.brandName} is generating…`}</span>
                  </div>
                  <p className="mt-1 text-xs text-label-tertiary">{selectedModel.brandName} {selectedModel.version} · {selectedRatio} · {selectedDuration}s</p>
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {videos.map(v => (
              <motion.div key={v.id} variants={cardVariant} className="bg-surface dark:bg-surface-tertiary border border-separator rounded-2xl overflow-hidden shadow-sm">
                <video src={v.url} controls className="w-full aspect-video bg-black" />
                <div className="p-4">
                  <p className="text-sm font-medium line-clamp-2">{v.prompt}</p>
                  <div className="mt-3 flex justify-between items-center">
                    <span className="text-[11px] text-label-secondary uppercase font-bold tracking-tight">{v.brand} · {v.version}</span>
                    <span className="text-[11px] text-label-tertiary">{v.ratio} · {v.duration}s</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => handleRefine(v)} className="h-8 px-3 rounded-lg text-xs font-semibold bg-fill/40 hover:bg-fill/60 transition-colors">
                      Reply / Refine
                    </button>
                    <button onClick={() => handleSaveToGallery(v)} className="h-8 px-3 rounded-lg text-xs font-semibold bg-apple-teal/10 text-apple-teal hover:bg-apple-teal/20 transition-colors">
                      Save to Gallery
                    </button>
                    <a href={v.url} download className="h-8 px-3 rounded-lg text-xs font-semibold bg-fill/40 hover:bg-fill/60 transition-colors inline-flex items-center">
                      Download
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {statusText && !isGenerating && (
          <div className="fixed top-20 right-8 px-4 py-2 bg-apple-teal text-white rounded-lg text-sm font-medium shadow-lg">
            {statusText}
          </div>
        )}

        <div className="fixed bottom-0 left-[304px] right-[368px] p-6 bg-gradient-to-t from-surface-secondary/95 via-surface-secondary/90 to-transparent dark:from-surface-secondary/95 dark:via-surface-secondary/90 dark:to-transparent backdrop-blur-sm pointer-events-none">
          <div className="max-w-6xl mx-auto pointer-events-auto">
            <div className="glass-float rounded-hig-2xl shadow-float overflow-hidden border border-separator/50">
              <div className="flex items-center border-b border-separator/30 bg-surface-secondary/40 dark:bg-[#2C2C2E]/40 backdrop-blur-sm">
                {(['text', 'image', 'video', 'audio'] as AIType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleAITypeChange(type)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${
                      activeAIType === type
                        ? 'border-apple-teal bg-white dark:bg-[#2C2C2E] text-apple-teal'
                        : 'border-transparent text-label-tertiary hover:text-label-primary hover:bg-white/30 dark:hover:bg-[#2C2C2E]/30'
                    }`}
                  >
                    {aiTypeIcons[type]}
                    <span>{type}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleGenerate} className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your video scene…"
                  className="w-full min-h-[80px] max-h-[240px] p-6 pr-16 bg-white dark:bg-[#2C2C2E] outline-none resize-none font-medium placeholder:text-label-tertiary text-label-primary"
                  rows={1}
                />
                <button
                  type="submit"
                  className="absolute right-4 bottom-4 w-12 h-12 flex items-center justify-center bg-apple-teal text-white rounded-hig-xl shadow-apple-teal disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                  disabled={isGenerating}
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none"><path d="M8 3.33331V12.6666M8 3.33331L4 7.33331M8 3.33331L12 7.33331" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
