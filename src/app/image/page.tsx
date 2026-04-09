'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import UnifiedControlsPanel from '@/shared/ui/layout/UnifiedControlsPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { IMAGE_MODELS, ASPECT_RATIOS, QUALITY_LEVELS, STYLE_PRESETS } from '@/domains/image-generation/services/image-models'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

type AIType = 'text' | 'image' | 'video' | 'audio'

export default function ImagePage() {
  const router = useRouter()
  const [selectedModel, setSelectedModel] = useState<typeof IMAGE_MODELS[number]>(IMAGE_MODELS[0])
  const [selectedRatio, setSelectedRatio] = useState('1:1')
  const [selectedQuality, setSelectedQuality] = useState('hd')
  const [selectedStyle, setSelectedStyle] = useState('photorealistic')
  const [activeAIType, setActiveAIType] = useState<AIType>('image')
  const [prompt, setPrompt] = useState('')
  const [generations, setGenerations] = useState<{ id: string; url: string; prompt: string; model: string; ratio: string }[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
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

      console.log('[v0] Image generated:', data.url)

      setGenerations([
        {
          id: Date.now().toString(),
          url: data.url,
          prompt,
          model: selectedModel.name,
          ratio: selectedRatio,
        },
        ...generations
      ])
      setPrompt('')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to generate image'
      console.error('[v0] Image generation error:', error)
      setErrorMessage(errorMsg)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAITypeChange = (type: AIType) => {
    setActiveAIType(type)
    if (type !== 'image') {
      router.push(`/${type}`)
    }
  }

  const aiTypeIcons = {
    text: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    image: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    video: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    audio: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
  }

  const settingsPanel = (
    <UnifiedControlsPanel
      type="image"
      models={IMAGE_MODELS}
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
    <ChatSidebar>
       <SidebarItem id="futuristic-city" title="Futuristic city" active />
       <SidebarItem id="cyberpunk-cat" title="Cyberpunk cat" />
       <SidebarItem id="minimalist-logo" title="Minimalist logo" />
    </ChatSidebar>
  )

  return (
    <AppLayout sidebar={sidebar} rightPanel={settingsPanel}>
      <div className="p-8 pb-64">
        {/* Error Message */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-hig-lg flex items-center gap-3"
          >
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{errorMessage}</p>
            </div>
            <button
              onClick={() => setErrorMessage('')}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Thinking Indicator */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex justify-start"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full gradient-brown-teal flex items-center justify-center flex-shrink-0 shadow-brown-glow">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="bg-surface-tertiary/60 dark:bg-surface/60 rounded-hig-xl px-4 py-3 border border-separator/30">
                <div className="flex items-center gap-2 text-sm text-label-secondary">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-brown dark:bg-teal rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-brown dark:bg-teal rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-brown dark:bg-teal rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-xs font-medium text-label-tertiary ml-2">
                    {selectedModel.name} is generating...
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6"
        >
          <AnimatePresence mode="popLayout">
            {generations.map((gen) => (
              <motion.div
                key={gen.id}
                variants={cardVariant}
                layout
                className="relative group bg-surface dark:bg-surface-tertiary border border-separator rounded-2xl overflow-hidden shadow-sm hover:shadow-hig transition-all break-inside-avoid"
              >
                <div className="relative aspect-square w-full">
                  <Image
                    src={gen.url}
                    alt={gen.prompt}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                   <p className="text-white text-xs line-clamp-2 mb-3">{gen.prompt}</p>
                   <div className="flex gap-2">
                      <button className="flex-grow h-8 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-white text-[11px] font-medium transition-colors">
                        Save to Gallery
                      </button>
                      <button className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-white transition-colors">
                        ↓
                      </button>
                   </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Message Input with Integrated Tabs - Fixed at bottom */}
        <div className="fixed bottom-0 left-[304px] right-[368px] p-6 bg-gradient-to-t from-surface-secondary/95 via-surface-secondary/90 to-transparent dark:from-surface-secondary/95 dark:via-surface-secondary/90 dark:to-transparent backdrop-blur-sm pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            {/* Tabbed Message Input Box */}
            <div className="glass-float rounded-hig-2xl shadow-float overflow-hidden border border-separator/50">
              {/* AI Type Tabs - Integrated into message box */}
              <div className="flex items-center border-b border-separator/30 bg-surface-secondary/40 dark:bg-[#2C2C2E]/40 backdrop-blur-sm">
                {(['text', 'image', 'video', 'audio'] as AIType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleAITypeChange(type)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 ${
                      activeAIType === type
                        ? 'border-brown dark:border-teal bg-white dark:bg-[#2C2C2E] text-brown dark:text-teal'
                        : 'border-transparent text-label-tertiary hover:text-label-primary hover:bg-white/30 dark:hover:bg-[#2C2C2E]/30'
                    }`}
                  >
                    {aiTypeIcons[type]}
                    <span>{type}</span>
                  </button>
                ))}
              </div>

              {/* Message Input Form */}
              <form onSubmit={handleGenerate} className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Describe the ${activeAIType} you want to create...`}
                  className="w-full min-h-[80px] max-h-[240px] p-6 pr-16 bg-white dark:bg-[#2C2C2E] outline-none resize-none font-medium placeholder:text-label-tertiary text-label-primary"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      const formEvent = new Event('submit', { cancelable: true }) as unknown as React.FormEvent<HTMLFormElement>;
                      handleGenerate(formEvent)
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={isGenerating || !prompt?.trim()}
                  className="absolute right-4 bottom-4 w-12 h-12 flex items-center justify-center gradient-brown-teal text-white rounded-hig-xl shadow-brown-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3.33331V12.6666M8 3.33331L4 7.33331M8 3.33331L12 7.33331" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
