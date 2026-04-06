'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'

export default function VideoPage() {
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
    <div className="p-6 space-y-8">
      <div className="space-y-4">
        <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Model</label>
        <select className="w-full h-10 px-3 bg-fill border-none rounded-lg text-sm outline-none">
          <option>Luma Dream Machine</option>
          <option>Runway Gen-3</option>
          <option>Kling 1.5</option>
        </select>
      </div>
      <div className="space-y-4">
        <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Duration</label>
        <div className="grid grid-cols-3 gap-2">
           <button className="h-10 rounded-lg bg-primary/10 border border-primary text-primary text-xs">5s</button>
           <button className="h-10 rounded-lg bg-surface border border-separator text-xs">10s</button>
           <button className="h-10 rounded-lg bg-surface border border-separator text-xs">15s</button>
        </div>
      </div>
    </div>
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

        <div className="fixed bottom-0 left-60 right-[280px] p-6 bg-gradient-to-t from-surface-secondary via-surface-secondary/90 to-transparent z-20">
          <div className="max-w-3xl mx-auto">
             <form onSubmit={handleGenerate} className="flex bg-surface border border-separator rounded-2xl shadow-hig overflow-hidden">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your video scene..."
                  className="flex-grow p-4 bg-transparent outline-none text-sm"
                />
                <button className="px-6 bg-primary text-white text-sm font-medium disabled:opacity-50" disabled={isGenerating}>
                  {isGenerating ? 'Processing...' : 'Generate Video'}
                </button>
             </form>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
