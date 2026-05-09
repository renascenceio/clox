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
  /** Soft-archive flag. Archived chats are hidden from the sidebar/recent
   *  surfaces but remain accessible from the /archives page. Distinct from
   *  the deleted-items bucket, which is for soft-deletion (and where "Delete
   *  forever" lives). */
  archived?: boolean
  archivedAt?: number
}

const CHATS_KEY = 'clox_chats'
const activeKey = (modality: Modality) => `activeChatId:${modality}`
const historyKey = (modality: Modality, chatId: string) =>
  modality === 'text' ? `chat-history-${chatId}` : `${modality}-history-${chatId}`

// ————————————————————————————————————————————————————————————————————————————
// One-time migration: purge fake audio / video URLs from pre-real-backend
// sessions. Earlier versions of the app returned SoundHelix sample MP3s and
// Google public-sample MP4s when "generating" audio / video; those URLs are
// now meaningless noise in users' history. We wipe them exactly once per
// browser by bumping CLOX_STORE_VERSION.
// ————————————————————————————————————————————————————————————————————————————
const STORE_VERSION_KEY = 'clox_store_version'
const CLOX_STORE_VERSION = '2'

const FAKE_URL_FRAGMENTS = [
  'soundhelix.com',
  'commondatastorage.googleapis.com/gtv-videos-bucket',
]

function hasFakeUrl(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false
  const url = (item as { url?: unknown }).url
  if (typeof url !== 'string') return false
  return FAKE_URL_FRAGMENTS.some(f => url.includes(f))
}

function runStoreMigrations(): void {
  if (typeof window === 'undefined') return
  const current = localStorage.getItem(STORE_VERSION_KEY)
  if (current === CLOX_STORE_VERSION) return

  try {
    // Walk every history-* key and strip clips that point at the old samples.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (!key) continue
      const isHistoryKey =
        key.startsWith('audio-history-') ||
        key.startsWith('video-history-') ||
        key.startsWith('chat-history-') ||
        key.startsWith('image-history-')
      if (!isHistoryKey) continue

      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) continue
        const cleaned = parsed.filter(item => !hasFakeUrl(item))
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(key, JSON.stringify(cleaned))
        }
      } catch {
        /* skip corrupt entries */
      }
    }
  } catch {
    /* localStorage not available – skip */
  }

  localStorage.setItem(STORE_VERSION_KEY, CLOX_STORE_VERSION)
}

// Run migrations on module load (client-only).
if (typeof window !== 'undefined') {
  runStoreMigrations()
}

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

// ————————————————————————————————————————————————————————————————————————————
// Archive / soft-delete
//
// Archive ≠ delete. Archive moves a chat / generation out of the active
// surfaces (sidebar, recent, gallery default tab) and onto the /archives
// page, where the user can restore or permanently delete. Soft-delete (the
// `deleted-items` bucket touched by ChatSidebar) is a separate, narrower
// concept and is being retired in favour of this archive flow.
// ————————————————————————————————————————————————————————————————————————————

export function archiveChat(id: string): void {
  saveChats(
    listChats().map(c =>
      c.id === id ? { ...c, archived: true, archivedAt: Date.now() } : c,
    ),
  )
}

export function unarchiveChat(id: string): void {
  saveChats(
    listChats().map(c =>
      c.id === id ? { ...c, archived: false, archivedAt: undefined } : c,
    ),
  )
}

/** Active chats — what sidebars and recent lists should show by default. */
export function listActiveChats(): Chat[] {
  return listChats().filter(c => !c.archived)
}

/** Archived chats — the /archives page reads from here. */
export function listArchivedChats(): Chat[] {
  return listChats().filter(c => c.archived)
}

/** Permanent removal — drops the chat record AND its history bucket. */
export function permanentlyDeleteChat(id: string): void {
  const chat = getChatById(id)
  if (chat) deleteHistory(chat.modality ?? 'text', chat.id)
  saveChats(listChats().filter(c => c.id !== id))
}

// ————————————————————————————————————————————————————————————————————————————
// Per-generation flags
//
// Generations (image/video/audio results) live as plain objects inside each
// chat's history array. We don't have a top-level generations table, so the
// archive flag rides along on the history record under a dedicated key —
// `_archived` — that doesn't collide with any provider's response shape.
// ————————————————————————————————————————————————————————————————————————————

export interface ArchivableGeneration {
  id?: string
  url?: string
  /** When true, this generation is hidden from the gallery and surfaced on
   *  the /archives page. */
  _archived?: boolean
  _archivedAt?: number
}

/** Flip a single generation's archive flag. Matches by `id` first, then by
 *  `url` as a fallback for older items that pre-date stable ids. */
export function setGenerationArchived(
  modality: Modality,
  chatId: string,
  match: { id?: string; url?: string },
  archived: boolean,
): void {
  const items = loadHistory<ArchivableGeneration>(modality, chatId)
  let changed = false
  const next = items.map(it => {
    const matches = (match.id && it.id && it.id === match.id) ||
                    (match.url && it.url && it.url === match.url)
    if (!matches) return it
    changed = true
    return { ...it, _archived: archived, _archivedAt: archived ? Date.now() : undefined }
  })
  if (!changed) return
  saveHistory(modality, chatId, next)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('clox-chats-changed'))
  }
}

/** Permanent removal of a single generation. */
export function permanentlyDeleteGeneration(
  modality: Modality,
  chatId: string,
  match: { id?: string; url?: string },
): void {
  const items = loadHistory<ArchivableGeneration>(modality, chatId)
  const next = items.filter(it => {
    const matches = (match.id && it.id && it.id === match.id) ||
                    (match.url && it.url && it.url === match.url)
    return !matches
  })
  if (next.length === items.length) return
  saveHistory(modality, chatId, next)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('clox-chats-changed'))
  }
}
