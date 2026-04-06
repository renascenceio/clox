'use client'

import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { cardVariant, stagger } from '@/shared/ui/layout/AppLayout'
import Image from 'next/image'

export default function GalleryPage() {
  const [activeTab, setActiveTab] = useState('All')

  const sidebar = (
    <ChatSidebar>
       <div className="px-2 mb-4">
          <div className="text-[11px] font-bold text-label-secondary uppercase tracking-tight px-2 mb-2">Projects</div>
          <SidebarItem title="Portfolio v1" active />
          <SidebarItem title="Social Media Ads" />
          <SidebarItem title="Research" />
          <button className="w-full text-left px-3 py-2 text-primary text-xs font-medium hover:bg-primary/5 rounded-lg transition-colors mt-2">
            + New Project
          </button>
       </div>
    </ChatSidebar>
  )

  const tabs = ['All', 'Text', 'Image', 'Video', 'Audio']

  return (
    <AppLayout sidebar={sidebar}>
      <div className="p-8">
        <div className="flex justify-between items-center mb-8">
           <h1 className="text-2xl font-bold tracking-tight">Gallery</h1>
           <div className="flex bg-fill p-1 rounded-xl">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    activeTab === tab
                      ? 'bg-surface shadow-sm text-primary'
                      : 'text-label-secondary hover:text-label'
                  }`}
                >
                  {tab}
                </button>
              ))}
           </div>
        </div>

        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
           {[1, 2, 3, 4, 5, 6].map(i => (
             <motion.div key={i} variants={cardVariant} className="bg-surface border border-separator rounded-2xl overflow-hidden shadow-sm aspect-square relative group">
                <Image
                  src={`https://picsum.photos/seed/gallery-${i}/800/800`}
                  alt="Gallery item"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                   <div className="text-white text-[10px] font-bold uppercase tracking-widest mb-1">Image · FLUX.1</div>
                   <div className="text-white text-xs font-medium truncate">Architecture visualization...</div>
                </div>
             </motion.div>
           ))}
        </motion.div>
      </div>
    </AppLayout>
  )
}
