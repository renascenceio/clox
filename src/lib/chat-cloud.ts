'use client'

/**
 * Keeps the browser's chats in step with the server (`saved_chats`).
 *
 * localStorage stays the fast local copy every page reads synchronously;
 * this module saves each change on the server shortly after it happens and,
 * once per tab, brings down chats made on other devices. Without it a new
 * laptop, another browser or a cleared cache meant an empty account.
 */

import {
  getChatById,
  listChats,
  loadHistory,
  onChatChange,
  saveChats,
  saveHistory,
  withoutChangeFeed,
  type Chat,
  type ChatChange,
  type Modality,
} from './chat-store'
import { cacheTranscript } from './transcript-store'
import { parseStored } from './storage/file-url'

const FLUSH_DELAY_MS = 1500
const MAX_BODY_CHARS = 3_800_000
const LONG_STRING = 60_000

type Pending = { record?: boolean; history?: unknown[]; modality?: Modality; deleted?: boolean; purge?: boolean }

const queue = new Map<string, Pending>()
let timer: number | null = null
let disabled = false
let started = false

/** Drop what would make a save huge: attached file bodies (data URLs) and
 *  very long tool outputs. The text of the conversation always stays. */
function slim(value: unknown, limit = LONG_STRING): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('data:') && value.length > 2048) return ''
    return value.length > limit ? `${value.slice(0, limit)}\n…[trimmed]` : value
  }
  if (Array.isArray(value)) return value.map(v => slim(v, limit))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = slim(v, limit)
    return out
  }
  return value
}

function historyBody(items: unknown[]): unknown[] | null {
  for (const limit of [LONG_STRING, 8_000, 1_500]) {
    const s = slim(items, limit) as unknown[]
    if (JSON.stringify(s).length <= MAX_BODY_CHARS) return s
  }
  return null
}

function enqueue(chatId: string, patch: Pending) {
  if (disabled) return
  const prev = queue.get(chatId) ?? {}
  queue.set(chatId, patch.purge ? { purge: true } : { ...prev, ...patch })
  if (timer) window.clearTimeout(timer)
  timer = window.setTimeout(() => { void flush() }, FLUSH_DELAY_MS)
}

async function send(chatId: string, p: Pending, keepalive = false): Promise<boolean> {
  const url = `/api/saved-chats/${encodeURIComponent(chatId)}`
  if (p.purge) {
    const res = await fetch(url, { method: 'DELETE', keepalive })
    return res.ok || res.status === 404
  }
  const chat = getChatById(chatId)
  const body: Record<string, unknown> = {}
  if (chat) {
    body.record = chat
    body.modality = chat.modality ?? 'text'
  } else if (p.modality) {
    body.modality = p.modality
  }
  if (p.deleted !== undefined) body.deleted = p.deleted
  else if (chat) body.deleted = false
  if (p.history) {
    const h = historyBody(p.history)
    if (h) body.history = h
    else console.warn('[clox] chat too large to save on the server:', chatId)
  }
  const json = JSON.stringify(body)
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: json,
    keepalive: keepalive && json.length < 60_000,
  })
  if (res.status === 401) disabled = true
  return res.ok || res.status === 401 || res.status === 413
}

async function flush(keepalive = false) {
  timer = null
  const batch = [...queue.entries()]
  queue.clear()
  await Promise.all(batch.map(async ([id, p]) => {
    try {
      if (!(await send(id, p, keepalive))) throw new Error('save failed')
    } catch {
      // Put it back unless something newer for the same chat is waiting.
      if (!queue.has(id) && !disabled) enqueue(id, p)
    }
  }))
}

function onChange(c: ChatChange) {
  switch (c.kind) {
    case 'record': return enqueue(c.chatId, { record: true })
    case 'removed': return enqueue(c.chatId, { deleted: true })
    case 'purged': return enqueue(c.chatId, { purge: true })
    case 'history': return enqueue(c.chatId, { history: c.items, modality: c.modality })
  }
}

type RemoteChat = {
  chatId: string
  modality: Modality
  record: Partial<Chat>
  hasHistory: boolean
  deletedAt: string | null
  updatedAt: string
}

const textHistoryKey = (id: string) => `chat-history-${id}`

function localHistory(chat: Chat): unknown[] {
  const mod = chat.modality ?? 'text'
  if (mod !== 'text') return loadHistory(mod, chat.id)
  const raw = localStorage.getItem(textHistoryKey(chat.id))
  if (!raw) return []
  try { return parseStored<unknown[]>(raw) } catch { return [] }
}

/** Bring down chats from other devices and upload chats only this browser
 *  has (everything made before saving on the server existed). */
async function pull() {
  const res = await fetch('/api/saved-chats', { cache: 'no-store' })
  if (res.status === 401) { disabled = true; return }
  if (!res.ok) return
  const { chats: remote } = (await res.json()) as { chats: RemoteChat[] }
  const byId = new Map(remote.map(r => [r.chatId, r]))
  const local = listChats()
  const localIds = new Set(local.map(c => c.id))

  const added: Chat[] = []
  const removed = new Set<string>()
  const mediaToFetch: RemoteChat[] = []
  for (const r of remote) {
    if (r.deletedAt) {
      if (localIds.has(r.chatId)) removed.add(r.chatId)
      continue
    }
    if (localIds.has(r.chatId) || !r.record?.id) continue
    added.push({ ...(r.record as Chat), id: r.chatId, modality: r.modality })
    if (r.modality !== 'text' && r.hasHistory) mediaToFetch.push(r)
  }

  if (added.length || removed.size) {
    withoutChangeFeed(() => {
      const next = [...local.filter(c => !removed.has(c.id)), ...added]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      saveChats(next)
      for (const id of removed) localStorage.removeItem(textHistoryKey(id))
    })
  }

  for (const c of local) {
    if (byId.has(c.id) || removed.has(c.id)) continue
    const items = localHistory(c)
    enqueue(c.id, items.length ? { record: true, history: items, modality: c.modality ?? 'text' } : { record: true })
  }

  // Generations are small (links), and the Gallery reads them synchronously.
  await Promise.all(mediaToFetch.slice(0, 40).map(async r => {
    const history = await fetchCloudHistory(r.chatId)
    if (history?.length) withoutChangeFeed(() => saveHistory(r.modality, r.chatId, history))
  }))
  if (mediaToFetch.length) window.dispatchEvent(new CustomEvent('clox-chats-changed'))
}

/** Messages / generations of one chat from the server, or null. */
export async function fetchCloudHistory(chatId: string): Promise<unknown[] | null> {
  if (disabled) return null
  try {
    const res = await fetch(`/api/saved-chats/${encodeURIComponent(chatId)}`, { cache: 'no-store' })
    if (!res.ok) return null
    const body = await res.json()
    return Array.isArray(body.history) ? parseStored<unknown[]>(JSON.stringify(body.history)) : null
  } catch {
    return null
  }
}

/** Load a text chat's transcript from the server into this browser. */
export async function restoreTranscript(chatId: string): Promise<unknown[] | null> {
  const history = await fetchCloudHistory(chatId)
  if (history?.length) cacheTranscript(chatId, history)
  return history
}

/** Start syncing (idempotent). Called once by the app shell. */
export function startChatCloud() {
  if (started || typeof window === 'undefined') return
  started = true
  onChatChange(onChange)
  void pull().catch(() => undefined)
  window.addEventListener('pagehide', () => { if (queue.size) void flush(true) })
}
