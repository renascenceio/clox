'use client'

import { useChat } from '@ai-sdk/react'
import AppLayout from '@/shared/ui/layout/AppLayout'
import ChatSidebar, { SidebarItem } from '@/shared/ui/layout/ChatSidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

const TEXT_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'openai' },
  { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google' },
  { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral' },
]

export default function TextPage() {
  const [selectedModel, setSelectedModel] = useState(TEXT_MODELS[0])
  const chat = useChat({
    api: '/api/chat',
    body: {
      model: selectedModel.id,
      provider: selectedModel.provider,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages = [], input = '', handleInputChange, handleSubmit, isLoading = false } = chat as any

  const settingsPanel = (
    <div className="p-6 space-y-8">
      <div className="space-y-4">
        <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Model</label>
        <select
          value={selectedModel.id}
          onChange={(e) => setSelectedModel(TEXT_MODELS.find(m => m.id === e.target.value)!)}
          className="w-full h-10 px-3 bg-fill border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
        >
          {TEXT_MODELS.map(model => (
            <option key={model.id} value={model.id}>{model.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
         <label className="text-[11px] font-bold text-label-secondary uppercase tracking-tight">Parameters</label>
         <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                 <span>Temperature</span>
                 <span className="text-label-secondary">0.7</span>
              </div>
              <input type="range" min="0" max="2" step="0.1" defaultValue="0.7" className="w-full accent-primary" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                 <span>Max Tokens</span>
                 <span className="text-label-secondary">2048</span>
              </div>
              <input type="range" min="256" max="32000" step="256" defaultValue="2048" className="w-full accent-primary" />
            </div>
         </div>
      </div>
    </div>
  )

  const sidebar = (
    <ChatSidebar>
       <SidebarItem title="Initial prompt..." active />
       <SidebarItem title="Refining the code" />
       <SidebarItem title="Marketing ideas" />
    </ChatSidebar>
  )

  return (
    <AppLayout sidebar={sidebar} rightPanel={settingsPanel}>
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
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-separator shadow-sm prose prose-sm max-w-none'
                }`}>
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="fixed bottom-0 left-60 right-[280px] p-6 bg-gradient-to-t from-surface-secondary via-surface-secondary/90 to-transparent">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative group">
              <textarea
                value={input}
                onChange={handleInputChange}
                placeholder="Message..."
                className="w-full min-h-[56px] max-h-[200px] p-4 pr-12 bg-surface border border-separator rounded-2xl shadow-hig focus:ring-2 focus:ring-primary/20 outline-none resize-none transition-all"
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
                className="absolute right-3 bottom-3 w-8 h-8 flex items-center justify-center bg-primary text-white rounded-xl disabled:opacity-50 transition-opacity"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 3.33331V12.6666M8 3.33331L4 7.33331M8 3.33331L12 7.33331" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </form>
            <div className="mt-2 text-center text-[11px] text-label-secondary">
              {selectedModel.name} · Cmd+Enter to send
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
