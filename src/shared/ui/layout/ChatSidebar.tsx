'use client'

import { motion } from 'framer-motion'
import { ReactNode, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Chat,
  Modality,
  listChats as listChatsFromStore,
  saveChats as saveChatsToStore,
  archiveChat as archiveChatInStore,
} from '@/lib/chat-store'
import RowActionsMenu, { RowActionIcons } from '@/shared/ui/components/RowActionsMenu'

/** Lightweight shape of a DB project as it shows up in the sidebar list. */
interface DbProject {
  id: string
  title: string
  archived_at: string | null
  my_role: 'owner' | 'admin' | 'member'
  member_count: number
  chat_count: number
  credit_budget_usd: number | null
  credit_spent_usd: number
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
  /**
   * When provided, the sidebar only shows chats whose `modality` matches, and
   * new chats created from here are tagged with that modality. Omit the prop
   * on pages that should see everything (e.g. the settings page).
   */
  modality?: Modality
}

const FOLDERS_KEY = 'clox_folders'

/**
 * DB projects cache — module-level + sessionStorage. The sidebar mounts on
 * every navigation, but `/api/projects` only changes when the user creates,
 * archives, or accepts an invite. We hold the result and refresh once per
 * session (and on the explicit `clox-projects-changed` / `clox-chats-synced`
 * events). This is the second-largest source of nav-time latency after the
 * profile fetch in AppLayout.
 */
const DB_PROJECTS_CACHE_KEY = 'clox.cache.dbProjects.v1'
let dbProjectsMemo: DbProject[] | null = null
let dbProjectsFetchedThisSession = false

function readCachedDbProjects(): DbProject[] | null {
  if (dbProjectsMemo) return dbProjectsMemo
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(DB_PROJECTS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DbProject[]
    dbProjectsMemo = parsed
    return parsed
  } catch { return null }
}
function writeCachedDbProjects(list: DbProject[]) {
  dbProjectsMemo = list
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.setItem(DB_PROJECTS_CACHE_KEY, JSON.stringify(list)) } catch { /* fine */ }
  }
}

export default function ChatSidebar({ activeChatId, onChatSelect, modality }: ChatSidebarProps) {
  // The search input + new-menu now live in AppLayout's left rail. Search state
  // is intentionally kept (always '' here) so the existing filter pipeline
  // below continues to work without a refactor.
  const search = ''
  const [chats, setChats] = useState<Chat[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
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

  // DB projects (canonical source for shared/multi-device project membership).
  // Initial state hydrates from the cache so the rail draws projects on the
  // very first render. We then refetch only when (a) it's the first time this
  // session, or (b) something else explicitly tells us the list changed.
  const [dbProjects, setDbProjects] = useState<DbProject[]>(
    () => (readCachedDbProjects() ?? []).filter(p => !p.archived_at),
  )
  const loadDbProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects?include=archived', { cache: 'no-store' })
      if (!res.ok) return
      const body = await res.json().catch(() => ({}))
      const list = (body.projects ?? []) as DbProject[]
      writeCachedDbProjects(list)
      setDbProjects(list.filter(p => !p.archived_at))
    } catch { /* offline — leave the cached value in place */ }
  }, [])
  useEffect(() => {
    if (!dbProjectsFetchedThisSession) {
      dbProjectsFetchedThisSession = true
      void loadDbProjects()
    }
    // Imperative refresh hooks — these intentionally bypass the
    // once-per-session guard because the caller has signalled real change.
    const refresh = () => { void loadDbProjects() }
    window.addEventListener('clox-projects-changed', refresh)
    window.addEventListener('clox-chats-synced', refresh)
    return () => {
      window.removeEventListener('clox-projects-changed', refresh)
      window.removeEventListener('clox-chats-synced', refresh)
    }
  }, [loadDbProjects])

  // Drag-and-drop bookkeeping. The currently dragged chat id is stored in a
  // ref-like state so drop-zones can render their hover state purely from CSS
  // when `dragOverProjectId` matches.
  const [draggingChatId, setDraggingChatId] = useState<string | null>(null)
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)

  // Load chats from the shared store and stay in sync with other workspaces.
  useEffect(() => {
    setChats(listChatsFromStore())
    const savedFolders = localStorage.getItem(FOLDERS_KEY)
    if (savedFolders) setFolders(JSON.parse(savedFolders))

    const refresh = () => setChats(listChatsFromStore())
    window.addEventListener('clox-chats-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('clox-chats-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  // The new-chat button now lives in AppLayout's rail header. It dispatches a
  // global `clox-new-chat` event so this sidebar (which owns the chat list)
  // can mint a new thread of the active modality and select it.
  useEffect(() => {
    const onNewChat = () => handleNewChat()
    window.addEventListener('clox-new-chat', onNewChat)
    return () => window.removeEventListener('clox-new-chat', onNewChat)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, modality])

  // Write-through helpers that keep local state and shared store aligned.
  const saveChats = (newChats: Chat[]) => {
    setChats(newChats)
    saveChatsToStore(newChats)
  }

  const saveFolders = (newFolders: Folder[]) => {
    setFolders(newFolders)
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(newFolders))
  }

  const handleNewChat = () => {
    const m: Modality = modality ?? 'text'
    const newChat: Chat = {
      id: `${m}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: 'New Chat',
      model: m === 'text' ? 'Gemini 2.5 Flash' : '',
      createdAt: Date.now(),
      type: 'chat',
      modality: m,
    }
    saveChats([newChat, ...chats])
    onChatSelect?.(newChat.id)
  }

  const handleDeleteChat = (id: string) => {
    const chatToDelete = chats.find(c => c.id === id)
    if (chatToDelete) {
      // Move to deleted items instead of permanent deletion
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

  // Move chat to project or remove from project. Updates localStorage
  // immediately for the optimistic UI, then PATCHes the DB row so the
  // project membership is durable across browsers/devices.
  const moveChatToProject = (chatId: string, projectId: string | undefined) => {
    saveChats(chats.map(c => c.id === chatId ? { ...c, projectId, folderId: undefined } : c))
    // The DB persistence is best-effort: if the chat hasn't been synced yet
    // (offline / brand new), the next chat-sync run will pick it up. If the
    // projectId here is a DB UUID, link it; if it's a legacy localStorage id,
    // skip the API call (legacy projects only exist client-side anyway).
    const isUuid = projectId
      ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
      : true
    if (!isUuid) return
    void (async () => {
      try {
        const res = await fetch(`/api/chats/${chatId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ project_id: projectId ?? null }),
        })
        if (res.ok) {
          // Refresh the DB project list so the chat-count badge stays honest.
          void loadDbProjects()
        }
      } catch { /* network blip — local copy is still correct */ }
    })()
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

  // Hide archived chats from the rail entirely — they live on /archives.
  const visibleChats = chats.filter(c => !c.archived)

  // When `modality` is provided, only show chats belonging to that workspace.
  // Legacy chats with no stored modality are treated as 'text' (see chat-store).
  const chatsForModality = modality
    ? visibleChats.filter(c => (c.modality ?? 'text') === modality)
    : visibleChats

  const handleArchiveChat = (id: string) => {
    archiveChatInStore(id)
    setChats(listChatsFromStore())
  }

  // Filter chats by search - exclude chats in folders or projects
  const filteredChats = chatsForModality.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) && !c.folderId && !c.projectId
  )

  const getChatsByFolder = (folderId: string) => 
    chats.filter(c => c.folderId === folderId)

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-y-auto px-2 space-y-5 custom-scrollbar pb-3">
        {/* Recent Activity — header lives in AppLayout's rail (mono "recent" eyebrow). */}
        <div className="space-y-0.5 pt-1">
          <div className="space-y-0.5">
            {filteredChats.filter(c => c.type !== 'project').length === 0 ? (
              <div className="px-4 py-3 font-mono text-[10px] tracking-[0.04em] text-ink-muted">
                no chats yet — press ⌘N
              </div>
            ) : (
              filteredChats.filter(c => c.type !== 'project').map(chat => (
                // Each chat row is draggable. We use a native HTML5 drag so
                // there's no extra dependency; the drop targets below handle
                // the linking. The drag image is the row itself.
                <div
                  key={chat.id}
                  draggable
                  onDragStart={(e) => {
                    setDraggingChatId(chat.id)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/x-clox-chat-id', chat.id)
                  }}
                  onDragEnd={() => {
                    setDraggingChatId(null)
                    setDragOverProjectId(null)
                  }}
                  className={draggingChatId === chat.id ? 'opacity-40' : ''}
                >
                  <SidebarItem
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
                    onArchive={() => handleArchiveChat(chat.id)}
                    onClick={() => onChatSelect?.(chat.id)}
                    projects={[
                      ...dbProjects.map(p => ({ id: p.id, title: p.title })),
                      ...chats.filter(c => c.type === 'project').map(p => ({ id: p.id, title: p.title })),
                    ]}
                    onMoveToProject={(projectId) => moveChatToProject(chat.id, projectId)}
                    currentProjectId={chat.projectId}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Projects ─────────────────────────────────────────────────────
            Two sources merge here: DB projects (canonical, multi-device,
            shared with members) and legacy localStorage "project" chats
            kept for back-compat. Both behave as drop targets so users can
            drag a chat onto either one to link it. */}
        {(dbProjects.length > 0 || filteredChats.filter(c => c.type === 'project').length > 0 || draggingChatId) && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-4 mb-1.5">
              <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">projects</span>
              <Link
                href="/projects"
                className="font-mono text-[9.5px] tracking-[0.06em] text-ink-muted hover:text-ink transition-colors"
              >
                manage →
              </Link>
            </div>

            {/* When the user is dragging, surface a clear "no project" zone
                at the top so they can detach a chat from its current project
                without opening a menu. */}
            {draggingChatId && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOverProjectId('__none__') }}
                onDragLeave={() => setDragOverProjectId(prev => prev === '__none__' ? null : prev)}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/x-clox-chat-id') || draggingChatId
                  if (id) moveChatToProject(id, undefined)
                  setDraggingChatId(null); setDragOverProjectId(null)
                }}
                className={`mx-2 mb-1.5 px-3 py-2 border border-dashed font-mono text-[10px] tracking-[0.04em] uppercase transition-colors ${
                  dragOverProjectId === '__none__'
                    ? 'border-accent text-accent bg-accent/[0.06]'
                    : 'border-hairline-soft text-ink-muted'
                }`}
              >
                drop here — no project
              </div>
            )}

            <div className="space-y-2">
              {/* DB projects first */}
              {dbProjects.map(project => {
                const dropping = dragOverProjectId === project.id
                const localChildren = chats.filter(c => c.projectId === project.id && c.type === 'chat')
                const total = (project.chat_count ?? 0) + localChildren.length
                return (
                  <div key={`db-${project.id}`} className="space-y-0.5">
                    <div
                      onDragOver={(e) => {
                        if (!draggingChatId) return
                        e.preventDefault()
                        setDragOverProjectId(project.id)
                      }}
                      onDragLeave={() => setDragOverProjectId(prev => prev === project.id ? null : prev)}
                      onDrop={(e) => {
                        e.preventDefault()
                        const id = e.dataTransfer.getData('text/x-clox-chat-id') || draggingChatId
                        if (id) moveChatToProject(id, project.id)
                        setDraggingChatId(null); setDragOverProjectId(null)
                      }}
                      className={`flex items-center gap-1 transition-colors ${
                        dropping ? 'bg-accent/[0.08] outline outline-1 outline-accent/40' : ''
                      }`}
                    >
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex-1 group flex items-center justify-between pl-4 pr-2 py-2 hover:bg-rail-soft transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="text-[13px] truncate text-ink-soft group-hover:text-ink">{project.title}</div>
                          <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted truncate mt-0.5">
                            {total === 0 ? 'project' : `project · ${total} chat${total === 1 ? '' : 's'}`}
                            {project.member_count > 1 ? ` · ${project.member_count} ppl` : ''}
                            {project.my_role !== 'owner' ? ` · ${project.my_role}` : ''}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                      </Link>
                    </div>
                    {/* Local chats already linked to this DB project (best-effort
                        until full DB chat listing arrives — keeps the sidebar
                        immediately useful after a drop). */}
                    {localChildren.length > 0 && (
                      <div className="ml-7 pl-3 border-l border-hairline-soft space-y-0">
                        {localChildren.map(chat => (
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
                            onArchive={() => handleArchiveChat(chat.id)}
                            onClick={() => onChatSelect?.(chat.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Legacy localStorage projects (kept until the user creates
                  proper DB projects). Same drop-zone behaviour. */}
              {filteredChats.filter(c => c.type === 'project').map(project => {
                const dropping = dragOverProjectId === project.id
                return (
                  <div key={`local-${project.id}`} className="space-y-0.5">
                    <div
                      onDragOver={(e) => {
                        if (!draggingChatId) return
                        e.preventDefault()
                        setDragOverProjectId(project.id)
                      }}
                      onDragLeave={() => setDragOverProjectId(prev => prev === project.id ? null : prev)}
                      onDrop={(e) => {
                        e.preventDefault()
                        const id = e.dataTransfer.getData('text/x-clox-chat-id') || draggingChatId
                        if (id) moveChatToProject(id, project.id)
                        setDraggingChatId(null); setDragOverProjectId(null)
                      }}
                      className={`flex items-center gap-1 transition-colors ${
                        dropping ? 'bg-accent/[0.08] outline outline-1 outline-accent/40' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <SidebarItem
                          id={project.id}
                          title={project.title}
                          model="Project · local"
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
                        onClick={(e) => { e.stopPropagation(); openProjectSettings(project.id) }}
                        className="p-1.5 hover:bg-rail-soft text-ink-muted hover:text-ink transition-colors"
                        title="Project settings"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </div>
                    {getChatsByProject(project.id).length > 0 && (
                      <div className="ml-7 pl-3 border-l border-hairline-soft space-y-0">
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
                            onArchive={() => handleArchiveChat(chat.id)}
                            onClick={() => onChatSelect?.(chat.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Folders */}
        {folders.length > 0 && (
          <div className="space-y-0.5">
            <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted px-4 mb-1.5">
              folders
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
        <div className="fixed inset-0 bg-ink/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowProjectSettings(null)}>
          <div className="bg-surface border border-hairline w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-hairline">
              <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted uppercase">project</div>
              <h3 className="font-serif italic text-2xl text-ink mt-1">Settings</h3>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div>
                <label className="block font-mono text-[10px] tracking-[0.04em] text-ink-muted mb-2 uppercase">system prompt</label>
                <textarea
                  value={projectSettings.systemPrompt}
                  onChange={(e) => setProjectSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="Enter a system prompt for this project..."
                  className="w-full h-24 p-3 bg-bg border border-hairline rounded-card text-sm text-ink outline-none focus:border-ink/40 resize-none"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] tracking-[0.04em] text-ink-muted mb-2 uppercase">
                  temperature — {projectSettings.temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={projectSettings.temperature}
                  onChange={(e) => setProjectSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-accent"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] tracking-[0.04em] text-ink-muted mb-2 uppercase">
                  max tokens — {projectSettings.maxTokens}
                </label>
                <input
                  type="range"
                  min="256"
                  max="8192"
                  step="256"
                  value={projectSettings.maxTokens}
                  onChange={(e) => setProjectSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                  className="w-full accent-accent"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] tracking-[0.04em] text-ink-muted mb-2 uppercase">default model</label>
                <select
                  value={projectSettings.modelId}
                  onChange={(e) => setProjectSettings(prev => ({ ...prev, modelId: e.target.value }))}
                  className="w-full p-3 bg-bg border border-hairline rounded-card text-sm text-ink outline-none focus:border-ink/40"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="claude-opus-4.6">Claude Opus 4.6</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-hairline flex justify-end gap-2">
              <button
                onClick={() => setShowProjectSettings(null)}
                className="px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase text-ink-soft hover:text-ink transition-colors"
              >
                cancel
              </button>
              <button
                onClick={saveProjectSettings}
                className="px-4 py-2 font-mono text-[11px] tracking-[0.04em] uppercase bg-ink text-bg hover:bg-ink-soft transition-colors"
              >
                save
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
  /** When provided, the row gets an "Archive" menu entry. Archive is the
   *  preferred way to clear clutter — Delete is destructive. */
  onArchive?: () => void
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
  onArchive,
  onClick,
  projects,
  onMoveToProject,
  currentProjectId
}: SidebarItemProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  return (
    <motion.div
      onClick={onClick}
      className={`group relative pl-4 pr-2 py-2 cursor-pointer transition-colors flex items-center justify-between hover:bg-rail-soft ${active ? 'bg-rail-soft' : ''}`}
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
            className="w-full text-[13px] font-medium bg-transparent outline-none border-b border-ink"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className={`text-[13px] truncate ${active ? 'text-ink font-medium' : 'text-ink-soft'}`}>
            {title}
          </div>
        )}
        {model && !isEditing && (
          <div className="font-mono text-[10px] tracking-[0.04em] text-ink-muted truncate mt-0.5">
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
                        currentProjectId === project.id ? 'text-mint dark:text-teal' : 'text-label-primary'
                      }`}
                    >
                      {project.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <RowActionsMenu
            title="Row actions"
            side="bottom-right"
            items={[
              { key: 'rename', label: 'Rename',  icon: RowActionIcons.rename,  onSelect: () => onStartEdit?.() },
              ...(onArchive ? [{
                key: 'archive', label: 'Archive', icon: RowActionIcons.archive,
                onSelect: () => onArchive(),
              }] : []),
              { key: 'delete', label: 'Delete', tone: 'destructive' as const, icon: RowActionIcons.delete, onSelect: () => onDelete?.() },
            ]}
          />
        </div>
      )}
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 top-0 bottom-0 w-[2px] bg-ink"
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
        className="group px-4 py-2 cursor-pointer transition-colors hover:bg-rail-soft flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-grow">
          <svg 
            className={`w-3 h-3 text-ink-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
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
              className="flex-grow text-[13px] bg-transparent outline-none border-b border-ink"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-[13px] text-ink-soft truncate">{title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.04em] text-ink-muted">
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
        <div className="ml-9 mt-0.5 space-y-0">
          {chats.map(chat => (
            <div 
              key={chat.id}
              onClick={() => onChatSelect?.(chat.id)}
              className={`px-2 py-1.5 text-[12px] cursor-pointer transition-colors ${
                chat.id === activeChatId 
                  ? 'text-ink font-medium' 
                  : 'text-ink-soft hover:text-ink'
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
