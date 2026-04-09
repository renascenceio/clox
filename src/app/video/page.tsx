'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import UnifiedControlsPanel from '@/shared/ui/layout/UnifiedControlsPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'
import { VIDEO_MODELS, VIDEO_ASPECT_RATIOS, VIDEO_DURATIONS, VIDEO_RESOLUTIONS } from '@/domains/video-generation/services/video-models'

export default function VideoPage() {
  const [selectedModel, setSelectedModel] = useState(VIDEO_MODELS[0])
  const [selectedRatio, setSelectedRatio] = useState('16:9')
  const [selectedDuration, setSelectedDuration] = useState(5)
  const [selectedResolution, setSelectedResolution] = useState('1080p')
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [videos, setVideos] = useState<{ id: string; url: string; prompt: string; model: string }[]>([])

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return
    setIsGenerating(true)
    setTimeout(() => {
      setVideos([{
        id: Date.now().toString(),
        url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
        prompt,
        model: 'Luma Dream Machine'
      }, ...videos])
      setIsGenerating(false)
      setPrompt('')
    }, 3000)
  }

  const settingsPanel = (
    <UnifiedControlsPanel
      type="video"
      models={VIDEO_MODELS}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      aspectRatios={VIDEO_ASPECT_RATIOS}
      selectedAspectRatio={selectedRatio}
      onAspectRatioChange={setSelectedRatio}
      durations={VIDEO_DURATIONS}
      selectedDuration={selectedDuration}
      onDurationChange={setSelectedDuration}
      resolution={selectedResolution}
      onResolutionChange={setSelectedResolution}
    />
  )

  const sidebar = (
    <ChatSidebar>
       <SidebarItem title="Walking in Tokyo" active />
       <SidebarItem title="Deep sea exploration" />
    </ChatSidebar>
  )

  return (
    <AppLayout sidebar={sidebar} rightPanel={settingsPanel}>
      <div className="p-8 pb-40">
        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <AnimatePresence>
             {videos.map(v => (
               <motion.div key={v.id} variants={cardVariant} className="bg-surface border border-separator rounded-2xl overflow-hidden shadow-sm">
                  <video src={v.url} controls className="w-full aspect-video bg-black" />
                  <div className="p-4">
                     <p className="text-sm font-medium line-clamp-1">{v.prompt}</p>
                     <div className="mt-4 flex justify-between items-center">
                        <span className="text-[11px] text-label-secondary uppercase font-bold tracking-tight">{v.model}</span>
                        <button className="text-primary text-xs font-medium">Save to Gallery</button>
                     </div>
                  </div>
               </motion.div>
             ))}
           </AnimatePresence>
        </motion.div>

        <div className="fixed bottom-0 left-[284px] right-[344px] p-6 bg-gradient-to-t from-surface-secondary via-surface-secondary/90 to-transparent z-20 pointer-events-none">
          <div className="max-w-3xl mx-auto pointer-events-auto">
             <form onSubmit={handleGenerate} className="flex glass-float rounded-hig-2xl shadow-float overflow-hidden focus-within:ring-2 focus-within:ring-brown/20">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your video scene..."
                  className="flex-grow p-5 bg-transparent outline-none text-sm font-medium placeholder:text-label-tertiary"
                />
                <button className="px-8 gradient-brown-teal text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-brown-glow transition-all" disabled={isGenerating}>
                  {isGenerating ? 'Processing...' : 'Generate Video'}
                </button>
             </form>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
