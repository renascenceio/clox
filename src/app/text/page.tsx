'use client'

import { useChat } from '@ai-sdk/react'
import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { TEXT_MODELS } from '@/domains/text-generation/services/model-router'

export default function TextPage() {
  const [selectedModel, setSelectedModel] = useState<typeof TEXT_MODELS[number]>(TEXT_MODELS[0])
  const [selectedBrand, setSelectedBrand] = useState<string>(selectedModel.brandName ||selectedModel.provider)
  
  const chat = useChat({
    api: '/api/chat',
    body: {
      model: selectedModel.id,
      provider: selectedModel.provider,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages = [], input = '', handleInputChange, handleSubmit, isLoading = false } = chat as any

  // Get unique brands and models for selected brand
  const brands = Array.from(new Set(TEXT_MODELS.map(m => m.brandName || m.provider)))
  const brandModels = TEXT_MODELS.filter(m => (m.brandName || m.provider) === selectedBrand)

  const handleBrandChange = (brand: string) => {
    setSelectedBrand(brand)
    const firstModel = TEXT_MODELS.find(m => (m.brandName || m.provider) === brand)
    if (firstModel) {
      setSelectedModel(firstModel)
    }
  }

  const handleModelChange = (modelId: string) => {
    const model = brandModels.find(m => m.id === modelId)
    if (model) {
      setSelectedModel(model)
    }
  }

  const sidebar = (
    <ChatSidebar>
       <SidebarItem title="Initial prompt..." active />
       <SidebarItem title="Refining the code" />
       <SidebarItem title="Marketing ideas" />
    </ChatSidebar>
  )

  return (
    <AppLayout 
      sidebar={sidebar}
      topBarContent={
        <div className="flex items-center gap-4">
          {/* Brand Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-label-tertiary uppercase tracking-widest">Brand</label>
            <select
              value={selectedBrand}
              onChange={(e) => handleBrandChange(e.target.value)}
              className="h-9 px-3 bg-white dark:bg-surface border-2 border-separator rounded-hig-lg text-sm font-bold text-label-primary focus:outline-none focus:ring-2 focus:ring-brown/20 focus:border-brown transition-all"
            >
              {brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          {/* Model Version Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-label-tertiary uppercase tracking-widest">Version</label>
            <select
              value={selectedModel.id}
              onChange={(e) => handleModelChange(e.target.value)}
              className="h-9 px-3 bg-white dark:bg-surface border-2 border-separator rounded-hig-lg text-sm font-bold text-label-primary focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal transition-all"
            >
              {brandModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.version || model.name}
                </option>
              ))}
            </select>
          </div>

          {/* Current Model Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-brown-50 to-teal-50 dark:from-brown-900/20 dark:to-teal-900/20 border border-brown-200 dark:border-brown-700 rounded-hig-lg">
            <div className="w-2 h-2 bg-brown rounded-full animate-pulse"></div>
            <span className="text-xs text-brown-700 dark:text-brown-300 font-bold">
              {selectedBrand} • {selectedModel.version || selectedModel.name}
            </span>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-full max-w-4xl mx-auto px-4 pt-10 pb-32">
        <div className="flex-grow space-y-8">
          <AnimatePresence initial={false}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {messages.map((m: any) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] px-5 py-4 rounded-hig-xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'gradient-brown-teal text-white shadow-brown-glow'
                    : 'glass-float shadow-hig prose prose-sm max-w-none'
                }`}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="fixed bottom-0 left-[284px] right-24 p-6 bg-gradient-to-t from-surface-secondary via-surface-secondary/90 to-transparent pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <form onSubmit={handleSubmit} className="relative group">
              <textarea
                value={input}
                onChange={handleInputChange}
                placeholder="Message..."
                className="w-full min-h-[56px] max-h-[200px] p-5 pr-14 glass-float rounded-hig-2xl shadow-float focus:ring-2 focus:ring-brown/20 outline-none resize-none transition-all font-medium placeholder:text-label-tertiary"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    const formEvent = new Event('submit', { cancelable: true }) as unknown as React.FormEvent<HTMLFormElement>;
                    handleSubmit(formEvent)
                  }
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !input?.trim()}
                className="absolute right-4 bottom-4 w-12 h-12 flex items-center justify-center gradient-brown-teal text-white rounded-hig-xl shadow-brown-glow disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95"
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3.33331V12.6666M8 3.33331L4 7.33331M8 3.33331L12 7.33331" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </form>
            <div className="mt-3 text-center text-xs text-label-tertiary font-medium">
              Cmd+Enter to send
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
