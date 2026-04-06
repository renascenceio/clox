'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { IMAGE_MODELS, ASPECT_RATIOS } from '@/domains/image-generation/services/image-models'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'

export default function ImagePage() {
  const [selectedModel, setSelectedModel] = useState(IMAGE_MODELS[0])
  const [selectedRatio, setSelectedRatio] = useState('1:1')
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
    <div className="p-6 space-y-8">
      <div className="space-y-4">
        <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Model</label>
        <select
          value={selectedModel.id}
          onChange={(e) => setSelectedModel(IMAGE_MODELS.find(m => m.id === e.target.value)!)}
          className="w-full h-10 px-3 bg-fill border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
        >
          {IMAGE_MODELS.map(model => (
            <option key={model.id} value={model.id}>{model.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Aspect Ratio</label>
        <div className="grid grid-cols-3 gap-2">
          {ASPECT_RATIOS.map(ratio => (
            <button
              key={ratio.value}
              onClick={() => setSelectedRatio(ratio.value)}
              className={`h-12 rounded-lg border text-xs flex items-center justify-center transition-all ${
                selectedRatio === ratio.value
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-surface border-separator hover:border-primary-light'
              }`}
            >
              {ratio.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
         <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Quality</label>
         <div className="grid grid-cols-2 gap-2">
            <button className="h-10 rounded-lg bg-primary/10 border border-primary text-primary text-xs">Standard</button>
            <button className="h-10 rounded-lg bg-surface border border-separator text-xs">HD</button>
         </div>
      </div>
    </div>
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
                <img src={gen.url} alt={gen.prompt} className="w-full h-auto" />
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

        <div className="fixed bottom-0 left-60 right-[280px] p-6 bg-gradient-to-t from-surface-secondary via-surface-secondary/90 to-transparent z-20">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleGenerate} className="relative group">
              <div className="flex bg-surface border border-separator rounded-2xl shadow-hig overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the image you want to create..."
                  className="flex-grow p-4 bg-transparent outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={isGenerating || !prompt.trim()}
                  className="px-6 bg-primary text-white text-sm font-medium disabled:opacity-50 transition-opacity"
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
