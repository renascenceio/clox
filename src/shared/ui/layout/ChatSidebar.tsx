'use client'

import { motion } from 'framer-motion'
import { ReactNode, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Chat {
  id: string
  title: string
  model: string
  createdAt: number
  type: 'chat' | 'project'
  projectId?: string
}

interface ProjectSettings {
  id: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  modelId: string
}

interface ChatSidebarProps {
  children?: ReactNode
  activeChatId?: string
  onChatSelect?: (chatId: string) => void
  externalSearch?: string
}

const CHATS_KEY = 'clox_chats'

export default function ChatSidebar({ activeChatId, onChatSelect, externalSearch }: ChatSidebarProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  // If externalSearch is provided, use it; otherwise use internal state
  const activeSearch = externalSearch !== undefined ? externalSearch : search
  const [chats, setChats] = useState<Chat[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [showProjectSettings, setShowProjectSettings] = useState<string | null>(null)
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>({
    id: '', systemPrompt: '', temperature: 0.7, maxTokens: 2048, modelId: 'gemini-2.5-flash'
  })

  useEffect(() => {
    const saved = localStorage.getItem(CHATS_KEY)
    if (saved) setChats(JSON.parse(saved))
  }, [])

  const saveChats = (newChats: Chat[]) => {
    setChats(newChats)
    localStorage.setItem(CHATS_KEY, JSON.stringify(newChats))
  }

  const handleChatClick = useCallback((chatId: string) => {
    localStorage.setItem('activeChatId', chatId)
    if (onChatSelect) {
      onChatSelect(chatId)
    } else {
      router.push('/text')
    }
  }, [onChatSelect, router])

  const handleDeleteChat = (id: string) => {
    const chatToDelete = chats.find(c => c.id === id)
    if (chatToDelete) {
      const deletedItems = JSON.parse(localStorage.getItem('deleted-items') || '[]')
      deletedItems.unshift({
        id: chatToDelete.id,
        title: chatToDelete.title,
        type: chatToDelete.type,
        model: chatToDelete.model,
        deletedAt: Date.now(),
      })
      localStorage.setItem('deleted-items', JSON.stringify(deletedItems))
    }
    saveChats(chats.filter(c => c.id !== id))
  }

  const handleRename = (id: string, newTitle: string) => {
    saveChats(chats.map(c => c.id === id ? { ...c, title: newTitle } : c))
    setEditingId(null)
  }

  const moveChatToProject = (chatId: string, projectId: string | undefined) => {
    saveChats(chats.map(c => c.id === chatId ? { ...c, projectId } : c))
  }

  const openProjectSettings = (projectId: string) => {
    const saved = localStorage.getItem(`project-settings-${projectId}`)
    setProjectSettings(saved ? JSON.parse(saved) : { id: projectId, systemPrompt: '', temperature: 0.7, maxTokens: 2048, modelId: 'gemini-2.5-flash' })
    setShowProjectSettings(projectId)
  }

  const saveProjectSettings = () => {
    localStorage.setItem(`project-settings-${projectSettings.id}`, JSON.stringify(projectSettings))
    setShowProjectSettings(null)
  }

  const getChatsByProject = (projectId: string) =>
    chats.filter(c => c.projectId === projectId && c.type === 'chat')

  const filteredChats = chats.filter(c =>
    c.title.toLowerCase().includes(activeSearch.toLowerCase()) && !c.projectId
  )

  const sidebarChats = filteredChats.filter(c => c.type === 'chat')
  const sidebarProjects = filteredChats.filter(c => c.type === 'project')

  return (
    <div className="flex flex-col h-full">
      {/* Standalone search — only shown when externalSearch is not provided (no AppLayout header) */}
      {externalSearch === undefined && (
        <div className="p-4">
          <div className="relative group">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 bg-surface-tertiary dark:bg-surface border border-separator/30 rounded-hig-lg text-xs focus:ring-2 focus:ring-brown/20 dark:focus:ring-teal/20 focus:border-brown/30 dark:focus:border-teal/30 outline-none transition-all placeholder:text-label-tertiary text-label-primary font-medium"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-label-tertiary group-focus-within:text-brown transition-colors pointer-events-none">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 14L11.1 11.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      )}

      <div className="flex-grow overflow-y-auto px-3 space-y-5 custom-scrollbar pb-6">
        {/* Recent chats */}
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold text-label-tertiary px-3 mb-2 uppercase tracking-widest flex justify-between">
            <span>Recent</span>
            {sidebarChats.length > 0 && <span>{sidebarChats.length}</span>}
          </div>
          {sidebarChats.length === 0 ? (
            <p className="px-3 py-3 text-xs text-label-tertiary text-center">No chats yet. Click + to start.</p>
          ) : (
            sidebarChats.map(chat => (
              <SidebarItem
                key={chat.id}
                id={chat.id}
                title={chat.title}
                model={chat.model}
                active={chat.id === activeChatId}
                isEditing={editingId === chat.id}
                editingTitle={editingTitle}
                onEditingTitleChange={setEditingTitle}
                onStartEdit={() => { setEditingId(chat.id); setEditingTitle(chat.title) }}
                onSaveEdit={() => handleRename(chat.id, editingTitle)}
                onCancelEdit={() => setEditingId(null)}
                onDelete={() => handleDeleteChat(chat.id)}
                onClick={() => handleChatClick(chat.id)}
                projects={sidebarProjects.map(p => ({ id: p.id, title: p.title }))}
                onMoveToProject={(pid) => moveChatToProject(chat.id, pid)}
                currentProjectId={chat.projectId}
              />
            ))
          )}
        </div>

        {/* Projects */}
        {sidebarProjects.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-label-tertiary px-3 mb-2 uppercase tracking-widest">Projects</div>
            <div className="space-y-2">
              {sidebarProjects.map(project => (
                <div key={project.id} className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <div className="flex-1">
                      <SidebarItem
                        id={project.id}
                        title={project.title}
                        model="Project"
                        active={project.id === activeChatId}
                        isEditing={editingId === project.id}
                        editingTitle={editingTitle}
                        onEditingTitleChange={setEditingTitle}
                        onStartEdit={() => { setEditingId(project.id); setEditingTitle(project.title) }}
                        onSaveEdit={() => handleRename(project.id, editingTitle)}
                        onCancelEdit={() => setEditingId(null)}
                        onDelete={() => handleDeleteChat(project.id)}
                        onClick={() => handleChatClick(project.id)}
                      />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openProjectSettings(project.id) }}
                      className="p-1.5 rounded-lg hover:bg-surface-tertiary dark:hover:bg-surface text-label-tertiary hover:text-brown dark:hover:text-teal transition-colors"
                      title="Project Settings"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </div>
                  {getChatsByProject(project.id).length > 0 && (
                    <div className="ml-4 pl-3 border-l border-separator/30 space-y-0.5">
                      {getChatsByProject(project.id).map(chat => (
                        <SidebarItem
                          key={chat.id}
                          id={chat.id}
                          title={chat.title}
                          model={chat.model}
                          active={chat.id === activeChatId}
                          isEditing={editingId === chat.id}
                          editingTitle={editingTitle}
                          onEditingTitleChange={setEditingTitle}
                          onStartEdit={() => { setEditingId(chat.id); setEditingTitle(chat.title) }}
                          onSaveEdit={() => handleRename(chat.id, editingTitle)}
                          onCancelEdit={() => setEditingId(null)}
                          onDelete={() => handleDeleteChat(chat.id)}
                          onClick={() => handleChatClick(chat.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Project Settings Modal */}
      {showProjectSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowProjectSettings(null)}>
          <div className="bg-surface-secondary dark:bg-[#2C2C2E] rounded-hig-2xl border border-separator shadow-float w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-separator">
              <h3 className="text-lg font-bold text-label-primary">Project Settings</h3>
              <p className="text-xs text-label-tertiary mt-1">Configure defaults for this project</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-label-secondary mb-2 uppercase tracking-widest">System Prompt</label>
                <textarea
                  value={projectSettings.systemPrompt}
                  onChange={(e) => setProjectSettings(p => ({ ...p, systemPrompt: e.target.value }))}
                  placeholder="Enter a system prompt..."
                  className="w-full h-24 p-3 bg-surface-tertiary dark:bg-surface border border-separator/30 rounded-hig-lg text-sm outline-none focus:ring-2 focus:ring-brown/20 dark:focus:ring-teal/20 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-label-secondary mb-2 uppercase tracking-widest">Temperature: {projectSettings.temperature}</label>
                <input type="range" min="0" max="2" step="0.1" value={projectSettings.temperature} onChange={(e) => setProjectSettings(p => ({ ...p, temperature: parseFloat(e.target.value) }))} className="w-full accent-brown dark:accent-teal" />
              </div>
              <div>
                <label className="block text-xs font-bold text-label-secondary mb-2 uppercase tracking-widest">Max Tokens: {projectSettings.maxTokens}</label>
                <input type="range" min="256" max="8192" step="256" value={projectSettings.maxTokens} onChange={(e) => setProjectSettings(p => ({ ...p, maxTokens: parseInt(e.target.value) }))} className="w-full accent-brown dark:accent-teal" />
              </div>
              <div>
                <label className="block text-xs font-bold text-label-secondary mb-2 uppercase tracking-widest">Default Model</label>
                <select value={projectSettings.modelId} onChange={(e) => setProjectSettings(p => ({ ...p, modelId: e.target.value }))} className="w-full p-3 bg-surface-tertiary dark:bg-surface border border-separator/30 rounded-hig-lg text-sm outline-none">
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="claude-opus-4.6">Claude Opus 4.6</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-separator flex justify-end gap-3">
              <button onClick={() => setShowProjectSettings(null)} className="px-4 py-2 text-sm font-bold text-label-primary hover:bg-surface-tertiary dark:hover:bg-surface rounded-hig-lg transition-colors">Cancel</button>
              <button onClick={saveProjectSettings} className="px-4 py-2 text-sm font-bold gradient-brown-teal text-white rounded-hig-lg shadow-brown-glow hover:scale-105 transition-transform">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface SidebarItemProps {
  id: string
  title: string
  model?: string
  active?: boolean
  isEditing?: boolean
  editingTitle?: string
  onEditingTitleChange?: (title: string) => void
  onStartEdit?: () => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  onDelete?: () => void
  onClick?: () => void
  projects?: { id: string; title: string }[]
  onMoveToProject?: (projectId: string | undefined) => void
  currentProjectId?: string
}

export function SidebarItem({
  title, model, active, isEditing, editingTitle, onEditingTitleChange,
  onStartEdit, onSaveEdit, onCancelEdit, onDelete, onClick,
  projects, onMoveToProject, currentProjectId
}: SidebarItemProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={onClick}
      className="group px-3 py-2.5 rounded-hig-lg cursor-pointer transition-all flex items-center justify-between relative hover:bg-surface-tertiary dark:hover:bg-surface"
    >
      <div className="flex-grow min-w-0 mr-2">
        {isEditing ? (
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => onEditingTitleChange?.(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit?.(); if (e.key === 'Escape') onCancelEdit?.() }}
            onBlur={onSaveEdit}
            autoFocus
            className="w-full text-sm font-bold bg-transparent outline-none border-b border-brown dark:border-teal"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className={`text-sm font-bold truncate ${active ? 'text-brown dark:text-teal' : 'text-label-primary'}`}>{title}</div>
        )}
        {model && !isEditing && (
          <div className={`text-[10px] font-medium truncate ${active ? 'text-brown/70 dark:text-teal/70' : 'text-label-tertiary'}`}>{model}</div>
        )}
      </div>
      {!isEditing && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {projects && projects.length > 0 && onMoveToProject && (
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu) }} className="w-5 h-5 rounded-md hover:bg-surface-tertiary dark:hover:bg-surface flex items-center justify-center text-label-secondary transition-colors" title="Move to Project">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              </button>
              {showMoveMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-surface-secondary dark:bg-[#2C2C2E] rounded-hig-lg border border-separator shadow-float z-50 overflow-hidden">
                  {currentProjectId && <button onClick={(e) => { e.stopPropagation(); onMoveToProject(undefined); setShowMoveMenu(false) }} className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-surface-tertiary dark:hover:bg-surface transition-colors text-label-secondary">Remove from Project</button>}
                  {projects.map(p => (
                    <button key={p.id} onClick={(e) => { e.stopPropagation(); onMoveToProject(p.id); setShowMoveMenu(false) }} className={`w-full px-3 py-2 text-left text-xs font-medium hover:bg-surface-tertiary dark:hover:bg-surface transition-colors ${currentProjectId === p.id ? 'text-brown dark:text-teal' : 'text-label-primary'}`}>{p.title}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={(e) => { e.stopPropagation(); onStartEdit?.() }} className="w-5 h-5 rounded-md hover:bg-surface-tertiary dark:hover:bg-surface flex items-center justify-center text-label-secondary transition-colors" title="Rename">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete?.() }} className="w-5 h-5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-label-secondary hover:text-red-500 transition-colors" title="Delete">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      )}
      {active && <motion.div layoutId="sidebar-active" className="absolute left-0 top-1 bottom-1 w-1 bg-brown dark:bg-teal rounded-full" />}
    </motion.div>
  )
}
