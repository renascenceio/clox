'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'

export default function AudioPage() {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [audios, setAudios] = useState<{ id: string; url: string; prompt: string; model: string }[]>([])

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return
    setIsGenerating(true)
    setTimeout(() => {
      setAudios([{
        id: Date.now().toString(),
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        prompt,
        model: 'Stable Audio 2.0'
      }, ...audios])
      setIsGenerating(false)
      setPrompt('')
    }, 2500)
  }

  const settingsPanel = (
    <div className="p-6 space-y-8">
      <div className="space-y-4">
        <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Model</label>
        <select className="w-full h-10 px-3 bg-fill border-none rounded-lg text-sm outline-none">
          <option>ElevenLabs v3</option>
          <option>Stable Audio 2.0</option>
          <option>Suno v4</option>
        </select>
      </div>
      <div className="space-y-4">
        <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Quality</label>
        <div className="grid grid-cols-2 gap-2">
           <button className="h-10 rounded-lg bg-primary/10 border border-primary text-primary text-xs">Standard</button>
           <button className="h-10 rounded-lg bg-surface border border-separator text-xs">Lossless</button>
        </div>
      </div>
    </div>
  )

  const sidebar = (
    <ChatSidebar>
       <SidebarItem title="Lo-fi hip hop" active />
       <SidebarItem title="Narrative voiceover" />
    </ChatSidebar>
  )

  return (
    <AppLayout sidebar={sidebar} rightPanel={settingsPanel}>
      <div className="p-8 pb-40">
        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 gap-6">
           <AnimatePresence>
             {audios.map(a => (
               <motion.div key={a.id} variants={cardVariant} className="bg-surface border border-separator rounded-2xl overflow-hidden shadow-sm p-6">
                  <div className="flex items-center gap-6">
                     <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                     </div>
                     <div className="flex-grow">
                        <p className="text-sm font-medium line-clamp-1">{a.prompt}</p>
                        <div className="mt-2 h-1 bg-separator rounded-full overflow-hidden">
                           <div className="w-1/3 h-full bg-primary" />
                        </div>
                        <div className="mt-2 flex justify-between items-center text-[11px] text-label-secondary uppercase font-bold tracking-tight">
                           <span>{a.model}</span>
                           <span>0:30 / 1:00</span>
                        </div>
                     </div>
                     <button className="text-primary text-xs font-medium shrink-0">Save to Gallery</button>
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
                  placeholder="Describe your sound or enter text for TTS..."
                  className="flex-grow p-4 bg-transparent outline-none text-sm"
                />
                <button className="px-6 bg-primary text-white text-sm font-medium disabled:opacity-50" disabled={isGenerating}>
                  {isGenerating ? 'Synthesizing...' : 'Generate Audio'}
                </button>
             </form>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
