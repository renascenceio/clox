/**
 * Centralised client-side chat store.
 *
 * Every workspace (text, image, video, audio) reads and writes through this
 * module so chats show up in the sidebar consistently, "Recent Activity" can
 * route back to the originating workspace from anywhere (including settings),
 * and generations are persisted per chat.
 *
 * Storage layout (all keys are strings in `localStorage`):
 *   clox_chats                        — JSON array of Chat records
 *   clox_folders                      — JSON array of Folder records (legacy)
 *   activeChatId:<modality>           — id of the active chat per modality
 *   chat-history-<chatId>             — text chat message history (per chat)
 *   image-history-<chatId>            — image generations (per chat)
 *   video-history-<chatId>            — video generations (per chat)
 *   audio-history-<chatId>            — audio generations (per chat)
 */

export type Modality = 'text' | 'image' | 'video' | 'audio'

export interface Chat {
  id: string
  title: string
  model: string
  createdAt: number
  type: 'chat' | 'project'
  /** New: which workspace this chat belongs to. Legacy chats default to 'text'. */
  modality?: Modality
  folderId?: string
  projectId?: string
}

const CHATS_KEY = 'clox_chats'
const activeKey = (modality: Modality) => `activeChatId:${modality}`
const historyKey = (modality: Modality, chatId: string) =>
  modality === 'text' ? `chat-history-${chatId}` : `${modality}-history-${chatId}`

// ————————————————————————————————————————————————————————————————————————————
// Chat list
// ————————————————————————————————————————————————————————————————————————————

export function listChats(): Chat[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CHATS_KEY)
    const parsed = raw ? (JSON.parse(raw) as Chat[]) : []
    // Back-compat: treat any legacy chat without a modality as 'text'.
    return parsed.map(c => ({ ...c, modality: c.modality ?? 'text' }))
  } catch {
    return []
  }
}

export function saveChats(chats: Chat[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
  window.dispatchEvent(new CustomEvent('clox-chats-changed'))
}

export function getChatById(id: string | undefined | null): Chat | undefined {
  if (!id) return undefined
  return listChats().find(c => c.id === id)
}

export function createChat(params: {
  modality: Modality
  title?: string
  model?: string
}): Chat {
  const chat: Chat = {
    id: `${params.modality}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: (params.title || 'New Chat').slice(0, 60).trim() || 'New Chat',
    model: params.model || '',
    createdAt: Date.now(),
    type: 'chat',
    modality: params.modality,
  }
  const chats = listChats()
  saveChats([chat, ...chats])
  return chat
}

export function renameChat(id: string, title: string): void {
  saveChats(
    listChats().map(c => (c.id === id ? { ...c, title: title.slice(0, 120) } : c))
  )
}

export function touchChat(id: string, updates: Partial<Pick<Chat, 'title' | 'model'>>): void {
  saveChats(listChats().map(c => (c.id === id ? { ...c, ...updates } : c)))
}

// ————————————————————————————————————————————————————————————————————————————
// Active chat (per modality)
// ————————————————————————————————————————————————————————————————————————————

export function getActiveChatId(modality: Modality): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(activeKey(modality))
}

export function setActiveChatId(modality: Modality, id: string | null): void {
  if (typeof window === 'undefined') return
  if (id) localStorage.setItem(activeKey(modality), id)
  else localStorage.removeItem(activeKey(modality))
  window.dispatchEvent(new CustomEvent('clox-active-chat-changed', { detail: { modality, id } }))
}

/**
 * Returns the active chat for the given modality. If none exists (or the
 * stored id points to a deleted chat), creates a fresh one using `title`
 * and marks it active.
 */
export function ensureActiveChat(modality: Modality, title?: string, model?: string): Chat {
  const activeId = getActiveChatId(modality)
  const existing = getChatById(activeId)
  if (existing && existing.modality === modality) {
    // Promote the auto-generated "New Chat" title to the first real prompt
    // the user sends so the sidebar shows meaningful names.
    if (title && (existing.title === 'New Chat' || !existing.title.trim())) {
      touchChat(existing.id, { title: title.slice(0, 60).trim() || 'New Chat' })
      return { ...existing, title }
    }
    return existing
  }
  const created = createChat({ modality, title, model })
  setActiveChatId(modality, created.id)
  return created
}

// ————————————————————————————————————————————————————————————————————————————
// Per-chat history (generations / messages)
// ————————————————————————————————————————————————————————————————————————————

export function loadHistory<T>(modality: Modality, chatId: string | null | undefined): T[] {
  if (!chatId || typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(historyKey(modality, chatId))
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

export function saveHistory<T>(modality: Modality, chatId: string, items: T[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(historyKey(modality, chatId), JSON.stringify(items))
}

export function deleteHistory(modality: Modality, chatId: string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(historyKey(modality, chatId))
}
