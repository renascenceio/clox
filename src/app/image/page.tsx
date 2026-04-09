'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import UnifiedControlsPanel from '@/shared/ui/layout/UnifiedControlsPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { IMAGE_MODELS, ASPECT_RATIOS, QUALITY_LEVELS, STYLE_PRESETS } from '@/domains/image-generation/services/image-models'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'
import Image from 'next/image'

export default function ImagePage() {
  const [selectedModel, setSelectedModel] = useState<typeof IMAGE_MODELS[number]>(IMAGE_MODELS[0])
  const [selectedRatio, setSelectedRatio] = useState('1:1')
  const [selectedQuality, setSelectedQuality] = useState('hd')
  const [selectedStyle, setSelectedStyle] = useState('photorealistic')
  const [prompt, setPrompt] = useState('')
  const [generations, setGenerations] = useState<{ id: string; url: string; prompt: string; model: string; ratio: string }[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return

    setIsGenerating(true)
    // Mocking generation for now
    setTimeout(() => {
      setGenerations([
        {
          id: Date.now().toString(),
          url: `https://picsum.photos/seed/${Math.random()}/1024/1024`,
          prompt,
          model: selectedModel.name,
          ratio: selectedRatio,
        },
        ...generations
      ])
      setIsGenerating(false)
      setPrompt('')
    }, 2000)
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
       <SidebarItem title="Futuristic city" active />
       <SidebarItem title="Cyberpunk cat" />
       <SidebarItem title="Minimalist logo" />
    </ChatSidebar>
  )

  return (
    <AppLayout sidebar={sidebar} rightPanel={settingsPanel}>
      <div className="p-8 pb-40">
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
                className="relative group bg-surface border border-separator rounded-2xl overflow-hidden shadow-sm hover:shadow-hig transition-all break-inside-avoid"
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

        <div className="fixed bottom-0 left-[284px] right-[344px] p-6 bg-gradient-to-t from-surface-secondary via-surface-secondary/90 to-transparent z-20 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
            <form onSubmit={handleGenerate} className="relative group">
              <div className="flex glass-float rounded-hig-2xl shadow-float overflow-hidden focus-within:ring-2 focus-within:ring-brown/20 transition-all">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the image you want to create..."
                  className="flex-grow p-5 bg-transparent outline-none text-sm font-medium placeholder:text-label-tertiary"
                />
                <button
                  type="submit"
                  disabled={isGenerating || !prompt.trim()}
                  className="px-8 gradient-brown-teal text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-brown-glow"
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
