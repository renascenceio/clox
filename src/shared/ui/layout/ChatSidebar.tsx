'use client'

import { motion } from 'framer-motion'
import { ReactNode, useState, useEffect } from 'react'

interface Chat {
  id: string
  title: string
  model: string
  createdAt: number
  type: 'chat' | 'project'
  folderId?: string
  projectId?: string // For chats that belong to a project
}

interface ProjectSettings {
  id: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  modelId: string
}

interface Folder {
  id: string
  title: string
  createdAt: number
}

interface ChatSidebarProps {
  children?: ReactNode
  activeChatId?: string
  onChatSelect?: (chatId: string) => void
}

// LocalStorage keys
const CHATS_KEY = 'clox_chats'
const FOLDERS_KEY = 'clox_folders'

export default function ChatSidebar({ activeChatId, onChatSelect }: ChatSidebarProps) {
  const [search, setSearch] = useState('')
  const [chats, setChats] = useState<Chat[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [showProjectSettings, setShowProjectSettings] = useState<string | null>(null)
  const [projectSettings, setProjectSettings] = useState<ProjectSettings>({
    id: '',
    systemPrompt: '',
    temperature: 0.7,
    maxTokens: 2048,
    modelId: 'gemini-2.5-flash'
  })

  // Load chats and folders from localStorage
  useEffect(() => {
    const savedChats = localStorage.getItem(CHATS_KEY)
    const savedFolders = localStorage.getItem(FOLDERS_KEY)
    if (savedChats) setChats(JSON.parse(savedChats))
    if (savedFolders) setFolders(JSON.parse(savedFolders))
  }, [])

  // Save chats to localStorage
  const saveChats = (newChats: Chat[]) => {
    setChats(newChats)
    localStorage.setItem(CHATS_KEY, JSON.stringify(newChats))
  }

  // Save folders to localStorage
  const saveFolders = (newFolders: Folder[]) => {
    setFolders(newFolders)
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(newFolders))
  }

  const handleNewChat = () => {
    const newChat: Chat = {
      id: `chat_${Date.now()}`,
      title: 'New Chat',
      model: 'Gemini 2.5 Flash',
      createdAt: Date.now(),
      type: 'chat'
    }
    saveChats([newChat, ...chats])
    setShowNewMenu(false)
    onChatSelect?.(newChat.id)
  }

  const handleNewProject = () => {
    const newProject: Chat = {
      id: `project_${Date.now()}`,
      title: 'New Project',
      model: '',
      createdAt: Date.now(),
      type: 'project'
    }
    saveChats([newProject, ...chats])
    setShowNewMenu(false)
    onChatSelect?.(newProject.id)
  }

  const handleNewFolder = () => {
    const newFolder: Folder = {
      id: `folder_${Date.now()}`,
      title: 'New Folder',
      createdAt: Date.now()
    }
    saveFolders([newFolder, ...folders])
    setShowNewMenu(false)
  }

  const handleDeleteChat = (id: string) => {
    saveChats(chats.filter(c => c.id !== id))
    // Also clear chat history and settings from localStorage
    localStorage.removeItem(`chat-history-${id}`)
    localStorage.removeItem(`chat-settings-${id}`)
  }

  const handleDeleteFolder = (id: string) => {
    // Remove folder and unassign chats from it
    const updatedChats = chats.map(c => c.folderId === id ? { ...c, folderId: undefined } : c)
    saveChats(updatedChats)
    saveFolders(folders.filter(f => f.id !== id))
  }

  const handleRename = (id: string, newTitle: string, type: 'chat' | 'folder') => {
    if (type === 'chat') {
      saveChats(chats.map(c => c.id === id ? { ...c, title: newTitle } : c))
    } else {
      saveFolders(folders.map(f => f.id === id ? { ...f, title: newTitle } : f))
    }
    setEditingId(null)
  }

  const startEditing = (id: string, currentTitle: string) => {
    setEditingId(id)
    setEditingTitle(currentTitle)
  }

  // Move chat to project or remove from project
  const moveChatToProject = (chatId: string, projectId: string | undefined) => {
    saveChats(chats.map(c => c.id === chatId ? { ...c, projectId, folderId: undefined } : c))
  }

  // Open project settings
  const openProjectSettings = (projectId: string) => {
    const savedSettings = localStorage.getItem(`project-settings-${projectId}`)
    if (savedSettings) {
      setProjectSettings(JSON.parse(savedSettings))
    } else {
      setProjectSettings({
        id: projectId,
        systemPrompt: '',
        temperature: 0.7,
        maxTokens: 2048,
        modelId: 'gemini-2.5-flash'
      })
    }
    setShowProjectSettings(projectId)
  }

  // Save project settings
  const saveProjectSettings = () => {
    localStorage.setItem(`project-settings-${projectSettings.id}`, JSON.stringify(projectSettings))
    setShowProjectSettings(null)
  }

  // Get chats that belong to a project
  const getChatsByProject = (projectId: string) => 
    chats.filter(c => c.projectId === projectId && c.type === 'chat')

  // Filter chats by search - exclude chats in folders or projects
  const filteredChats = chats.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase()) && !c.folderId && !c.projectId
  )

  const getChatsByFolder = (folderId: string) => 
    chats.filter(c => c.folderId === folderId)

  return (
    <div className="flex flex-col h-full bg-surface dark:bg-surface-secondary">
      <div className="p-5 space-y-4">
        {/* New Button with Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowNewMenu(!showNewMenu)}
            className="w-full h-11 gradient-brown-teal text-white rounded-hig-xl font-bold transition-all shadow-brown-glow hover:shadow-hig-hover hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="text-lg">+</span> New
          </button>
          {showNewMenu && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-surface dark:bg-surface-secondary border border-separator rounded-hig-lg shadow-float z-50 overflow-hidden">
              <button
                onClick={handleNewChat}
                className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-surface-tertiary dark:hover:bg-surface transition-colors flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-brown dark:text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                New Chat
              </button>
              <button
                onClick={handleNewProject}
                className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-surface-tertiary dark:hover:bg-surface transition-colors flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-brown dark:text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                New Project
              </button>
              <button
                onClick={handleNewFolder}
                className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-surface-tertiary dark:hover:bg-surface transition-colors flex items-center gap-3"
              >
                <svg className="w-4 h-4 text-brown dark:text-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                New Folder
              </button>
            </div>
          )}
        </div>

        <div className="relative group">
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 bg-surface-tertiary dark:bg-surface border border-separator/30 rounded-hig-lg text-xs focus:ring-2 focus:ring-brown/20 dark:focus:ring-teal/20 focus:border-brown/30 dark:focus:border-teal/30 outline-none transition-all placeholder:text-label-tertiary text-label-primary font-medium"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-label-secondary/40 group-focus-within:text-brown transition-colors">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M14 14L11.1 11.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto px-3 space-y-6 custom-scrollbar pb-10">
        {/* Recent Activity */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-label-secondary px-3 mb-2 uppercase tracking-widest flex justify-between items-center">
            <span>Recent Activity</span>
            {filteredChats.filter(c => c.type !== 'project').length > 0 && (
              <span className="text-label-tertiary">{filteredChats.filter(c => c.type !== 'project').length}</span>
            )}
          </div>
          <div className="space-y-0.5">
            {filteredChats.filter(c => c.type !== 'project').length === 0 ? (
              <div className="px-3 py-4 text-xs text-label-tertiary text-center">
                No chats yet. Click + New to start.
              </div>
            ) : (
              filteredChats.filter(c => c.type !== 'project').map(chat => (
                <SidebarItem
                  key={chat.id}
                  id={chat.id}
                  title={chat.title}
                  model={chat.type === 'project' ? 'Project' : chat.model}
                  active={chat.id === activeChatId}
                  isEditing={editingId === chat.id}
                  editingTitle={editingTitle}
                  onEditingTitleChange={setEditingTitle}
                  onStartEdit={() => startEditing(chat.id, chat.title)}
                  onSaveEdit={() => handleRename(chat.id, editingTitle, 'chat')}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={() => handleDeleteChat(chat.id)}
                  onClick={() => onChatSelect?.(chat.id)}
                  projects={chats.filter(c => c.type === 'project').map(p => ({ id: p.id, title: p.title }))}
                  onMoveToProject={(projectId) => moveChatToProject(chat.id, projectId)}
                  currentProjectId={chat.projectId}
                />
              ))
            )}
          </div>
        </div>

        {/* Projects */}
        {filteredChats.filter(c => c.type === 'project').length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-label-secondary px-3 mb-2 uppercase tracking-widest">
              Projects
            </div>
            <div className="space-y-2">
              {filteredChats.filter(c => c.type === 'project').map(project => (
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
                        onStartEdit={() => startEditing(project.id, project.title)}
                        onSaveEdit={() => handleRename(project.id, editingTitle, 'chat')}
                        onCancelEdit={() => setEditingId(null)}
                        onDelete={() => handleDeleteChat(project.id)}
                        onClick={() => onChatSelect?.(project.id)}
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openProjectSettings(project.id)
                      }}
                      className="p-1.5 rounded-lg hover:bg-surface-tertiary dark:hover:bg-surface text-label-tertiary hover:text-brown dark:hover:text-teal transition-colors"
                      title="Project Settings"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </div>
                  {/* Chats within this project */}
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
                          onStartEdit={() => startEditing(chat.id, chat.title)}
                          onSaveEdit={() => handleRename(chat.id, editingTitle, 'chat')}
                          onCancelEdit={() => setEditingId(null)}
                          onDelete={() => handleDeleteChat(chat.id)}
                          onClick={() => onChatSelect?.(chat.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Folders */}
        {folders.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-label-secondary px-3 mb-2 uppercase tracking-widest">
              Folders
            </div>
            <div className="space-y-0.5">
              {folders.map(folder => (
                <FolderItem
                  key={folder.id}
                  id={folder.id}
                  title={folder.title}
                  chats={getChatsByFolder(folder.id)}
                  activeChatId={activeChatId}
                  isEditing={editingId === folder.id}
                  editingTitle={editingTitle}
                  onEditingTitleChange={setEditingTitle}
                  onStartEdit={() => startEditing(folder.id, folder.title)}
                  onSaveEdit={() => handleRename(folder.id, editingTitle, 'folder')}
                  onCancelEdit={() => setEditingId(null)}
                  onDelete={() => handleDeleteFolder(folder.id)}
                  onChatSelect={onChatSelect}
                />
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
              <p className="text-xs text-label-tertiary mt-1">Configure default settings for this project</p>
            </div>
            <div className="p-6 space-y-4">
              {/* System Prompt */}
              <div>
                <label className="block text-xs font-bold text-label-secondary mb-2 uppercase tracking-widest">System Prompt</label>
                <textarea
                  value={projectSettings.systemPrompt}
                  onChange={(e) => setProjectSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="Enter a system prompt for this project..."
                  className="w-full h-24 p-3 bg-surface-tertiary dark:bg-surface border border-separator/30 rounded-hig-lg text-sm outline-none focus:ring-2 focus:ring-brown/20 dark:focus:ring-teal/20 resize-none"
                />
              </div>
              {/* Temperature */}
              <div>
                <label className="block text-xs font-bold text-label-secondary mb-2 uppercase tracking-widest">
                  Temperature: {projectSettings.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={projectSettings.temperature}
                  onChange={(e) => setProjectSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-brown dark:accent-teal"
                />
              </div>
              {/* Max Tokens */}
              <div>
                <label className="block text-xs font-bold text-label-secondary mb-2 uppercase tracking-widest">
                  Max Tokens: {projectSettings.maxTokens}
                </label>
                <input
                  type="range"
                  min="256"
                  max="8192"
                  step="256"
                  value={projectSettings.maxTokens}
                  onChange={(e) => setProjectSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                  className="w-full accent-brown dark:accent-teal"
                />
              </div>
              {/* Model Selection */}
              <div>
                <label className="block text-xs font-bold text-label-secondary mb-2 uppercase tracking-widest">Default Model</label>
                <select
                  value={projectSettings.modelId}
                  onChange={(e) => setProjectSettings(prev => ({ ...prev, modelId: e.target.value }))}
                  className="w-full p-3 bg-surface-tertiary dark:bg-surface border border-separator/30 rounded-hig-lg text-sm outline-none focus:ring-2 focus:ring-brown/20 dark:focus:ring-teal/20"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="claude-opus-4.6">Claude Opus 4.6</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-separator flex justify-end gap-3">
              <button
                onClick={() => setShowProjectSettings(null)}
                className="px-4 py-2 text-sm font-bold text-label-primary hover:bg-surface-tertiary dark:hover:bg-surface rounded-hig-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveProjectSettings}
                className="px-4 py-2 text-sm font-bold gradient-brown-teal text-white rounded-hig-lg shadow-brown-glow hover:scale-105 transition-transform"
              >
                Save Settings
              </button>
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
  title, 
  model, 
  active, 
  isEditing, 
  editingTitle, 
  onEditingTitleChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onClick,
  projects,
  onMoveToProject,
  currentProjectId
}: SidebarItemProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  return (
    <motion.div
      whileHover={{ x: 4 }}
      onClick={onClick}
      className={`group px-3 py-2.5 rounded-hig-lg cursor-pointer transition-all flex items-center justify-between relative hover:bg-surface-tertiary dark:hover:bg-surface`}
    >
      <div className="flex-grow min-w-0 mr-2">
        {isEditing ? (
          <input
            type="text"
            value={editingTitle}
            onChange={(e) => onEditingTitleChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit?.()
              if (e.key === 'Escape') onCancelEdit?.()
            }}
            onBlur={onSaveEdit}
            autoFocus
            className="w-full text-sm font-bold bg-transparent outline-none border-b border-brown dark:border-teal"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className={`text-sm font-bold truncate ${active ? 'text-brown dark:text-teal' : 'text-label-primary'}`}>
            {title}
          </div>
        )}
        {model && !isEditing && (
          <div className={`text-[10px] font-medium ${active ? 'text-brown/70 dark:text-teal/70' : 'text-label-tertiary'} truncate`}>
            {model}
          </div>
        )}
      </div>
      {!isEditing && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          {projects && projects.length > 0 && onMoveToProject && (
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
                className="w-5 h-5 rounded-md hover:bg-surface-tertiary dark:hover:bg-surface flex items-center justify-center text-xs text-label-secondary transition-colors"
                title="Move to Project"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
              {showMoveMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-surface-secondary dark:bg-[#2C2C2E] rounded-hig-lg border border-separator shadow-float z-50 overflow-hidden">
                  {currentProjectId && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveToProject(undefined); setShowMoveMenu(false); }}
                      className="w-full px-3 py-2 text-left text-xs font-medium hover:bg-surface-tertiary dark:hover:bg-surface transition-colors text-label-secondary"
                    >
                      Remove from Project
                    </button>
                  )}
                  {projects.map(project => (
                    <button
                      key={project.id}
                      onClick={(e) => { e.stopPropagation(); onMoveToProject(project.id); setShowMoveMenu(false); }}
                      className={`w-full px-3 py-2 text-left text-xs font-medium hover:bg-surface-tertiary dark:hover:bg-surface transition-colors ${
                        currentProjectId === project.id ? 'text-brown dark:text-teal' : 'text-label-primary'
                      }`}
                    >
                      {project.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onStartEdit?.(); }}
            className="w-5 h-5 rounded-md hover:bg-surface-tertiary dark:hover:bg-surface flex items-center justify-center text-xs text-label-secondary transition-colors"
            title="Rename"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            className="w-5 h-5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-xs text-label-secondary hover:text-red-500 transition-colors"
            title="Delete"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-1 bottom-1 w-1 bg-brown dark:bg-teal rounded-full"
        />
      )}
    </motion.div>
  )
}

interface FolderItemProps {
  id: string
  title: string
  chats: Chat[]
  activeChatId?: string
  isEditing?: boolean
  editingTitle?: string
  onEditingTitleChange?: (title: string) => void
  onStartEdit?: () => void
  onSaveEdit?: () => void
  onCancelEdit?: () => void
  onDelete?: () => void
  onChatSelect?: (chatId: string) => void
}

function FolderItem({ 
  title, 
  chats, 
  activeChatId,
  isEditing,
  editingTitle,
  onEditingTitleChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onChatSelect
}: FolderItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="group px-3 py-2 rounded-hig-lg cursor-pointer transition-all hover:bg-surface-tertiary dark:hover:bg-surface flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-grow">
          <svg 
            className={`w-3 h-3 text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-all ${isExpanded ? 'rotate-90' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4 text-label-secondary group-hover:text-brown dark:group-hover:text-teal transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {isEditing ? (
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => onEditingTitleChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveEdit?.()
                if (e.key === 'Escape') onCancelEdit?.()
              }}
              onBlur={onSaveEdit}
              autoFocus
              className="flex-grow text-sm font-medium bg-transparent outline-none border-b border-brown dark:border-teal"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-sm font-medium text-label-primary group-hover:text-brown dark:group-hover:text-teal truncate">{title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-label-secondary group-hover:text-teal dark:group-hover:text-brown transition-colors">
            {chats.length}
          </span>
          {!isEditing && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); onStartEdit?.(); }}
                className="w-5 h-5 rounded-md hover:bg-surface flex items-center justify-center text-xs text-label-secondary transition-colors"
                title="Rename"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
                className="w-5 h-5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-xs text-label-secondary hover:text-red-500 transition-colors"
                title="Delete"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
      {isExpanded && chats.length > 0 && (
        <div className="ml-6 mt-1 space-y-0.5">
          {chats.map(chat => (
            <div 
              key={chat.id}
              onClick={() => onChatSelect?.(chat.id)}
              className={`px-3 py-1.5 text-xs cursor-pointer transition-colors rounded-md ${
                chat.id === activeChatId 
                  ? 'text-brown dark:text-teal font-medium' 
                  : 'text-label-secondary hover:text-label-primary'
              }`}
            >
              {chat.title}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
