'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import UnifiedControlsPanel from '@/shared/ui/layout/UnifiedControlsPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'
import { VIDEO_MODELS, VIDEO_ASPECT_RATIOS, VIDEO_DURATIONS } from '@/domains/video-generation/services/video-models'
import { useRouter } from 'next/navigation'

type AIType = 'text' | 'image' | 'video' | 'audio'

export default function VideoPage() {
  const router = useRouter()
  const [selectedModel, setSelectedModel] = useState<typeof VIDEO_MODELS[number]>(VIDEO_MODELS[0])
  const [selectedRatio, setSelectedRatio] = useState('16:9')
  const [selectedDuration, setSelectedDuration] = useState(5)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [videos, setVideos] = useState<{ id: string; url: string; prompt: string; model: string }[]>([])
  const [activeAIType, setActiveAIType] = useState<AIType>('video')

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
      models={VIDEO_MODELS}
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
       <SidebarItem title="Walking in Tokyo" active />
       <SidebarItem title="Deep sea exploration" />
    </ChatSidebar>
  )

  return (
    <AppLayout sidebar={sidebar} rightPanel={settingsPanel}>
      <div className="flex flex-col h-full max-w-6xl mx-auto px-4 pt-10 pb-48">
        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
           <AnimatePresence>
             {videos.map(v => (
               <motion.div key={v.id} variants={cardVariant} className="bg-surface dark:bg-surface-tertiary border border-separator rounded-2xl overflow-hidden shadow-sm">
                  <video src={v.url} controls className="w-full aspect-video bg-black" />
                  <div className="p-4">
                     <p className="text-sm font-medium line-clamp-1">{v.prompt}</p>
                     <div className="mt-4 flex justify-between items-center">
                        <span className="text-[11px] text-label-secondary uppercase font-bold tracking-tight">{v.model}</span>
                        <button className="text-brown dark:text-teal text-xs font-medium hover:underline">Save to Gallery</button>
                     </div>
                  </div>
               </motion.div>
             ))}
           </AnimatePresence>
        </motion.div>

        {/* Message Input with Integrated Tabs */}
        <div className="fixed bottom-0 left-[304px] right-[368px] p-6 bg-gradient-to-t from-surface-secondary/95 via-surface-secondary/90 to-transparent dark:from-surface-secondary/95 dark:via-surface-secondary/90 dark:to-transparent backdrop-blur-sm pointer-events-none">
          <div className="max-w-6xl mx-auto pointer-events-auto">
            {/* Tabbed Message Input Box */}
            <div className="glass-float rounded-hig-2xl shadow-float overflow-hidden border border-separator/50">
              {/* AI Type Tabs */}
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

              {/* Input Form */}
              <form onSubmit={handleGenerate} className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your video scene..."
                  className="w-full min-h-[80px] max-h-[240px] p-6 pr-28 bg-white dark:bg-[#2C2C2E] outline-none resize-none font-medium placeholder:text-label-tertiary text-label-primary"
                  rows={1}
                />
                <button 
                  type="submit"
                  className="absolute right-4 bottom-4 px-6 py-2.5 gradient-brown-teal text-white text-sm font-bold rounded-hig-lg disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-brown-glow transition-all" 
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Processing...' : 'Generate'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
