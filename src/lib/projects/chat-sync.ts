/**
 * One-time-per-session migration that pushes localStorage chats up to the DB.
 *
 * Why: pre-projects-v2, chats lived only in `clox_chats` localStorage. To
 * support cross-browser membership, drag-and-drop into shared projects, and
 * usage attribution, the canonical record needs to be in the `chats` Postgres
 * table. The user-chosen path is "migrate to DB on next login": we keep
 * localStorage as a cache + offline fallback, but every chat the user touches
 * after login gets a row in `public.chats` with the same id.
 *
 * The migration is idempotent — `POST /api/chats` upserts on `id` for the
 * authed user, so calling this twice is a no-op for existing rows.
 *
 * It runs at most once per session. We track that with a flag in
 * sessionStorage so a tab refresh doesn't re-fire the network calls, but a
 * fresh login (or new tab on a different device) will re-sync, which is fine
 * because the API is idempotent.
 */

import { listChats, type Chat as LocalChat } from '@/lib/chat-store'

const SESSION_FLAG = 'clox_chats_synced_v1'

/**
 * Convert a localStorage chat id to a UUID acceptable to Postgres. Existing
 * ids look like `text_1715000000000_xyz123` which is not a UUID — Postgres
 * will refuse it. We hash it down to a stable v4-ish UUID so the same legacy
 * id always maps to the same DB id (so a re-sync overwrites the same row).
 */
async function legacyIdToUuid(legacyId: string): Promise<string> {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      legacyId,
    )
  ) {
    return legacyId
  }
  const enc = new TextEncoder().encode('clox::' + legacyId)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  const b = new Uint8Array(buf)
  // Force the version (4) and variant (10xx) bits so it parses as a UUIDv4.
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const hex = Array.from(b.slice(0, 16))
    .map(x => x.toString(16).padStart(2, '0'))
    .join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

/**
 * In-memory map from legacy id -> UUID, populated by `syncLocalChatsToDB`.
 * Other client modules can read this to know which DB id to send when calling
 * generation routes from a chat that originated in localStorage.
 */
const idMap = new Map<string, string>()

export function getDbIdForChat(legacyId: string): string | null {
  return idMap.get(legacyId) ?? null
}

/**
 * Walk localStorage chats and ensure each has a row in `public.chats`. Skips
 * chats whose `type === 'project'` because those represent the legacy
 * "project as a chat" UI concept and don't belong in the chats table. Real
 * project rows live in `public.projects` and are created via /projects.
 */
export async function syncLocalChatsToDB(): Promise<void> {
  if (typeof window === 'undefined') return
  if (sessionStorage.getItem(SESSION_FLAG) === '1') return

  const local: LocalChat[] = listChats()
  const realChats = local.filter(c => c.type !== 'project')
  if (realChats.length === 0) {
    sessionStorage.setItem(SESSION_FLAG, '1')
    return
  }

  // Don't choke if the device is offline — just skip and try again next time.
  try {
    const probe = await fetch('/api/chats', { cache: 'no-store' })
    if (!probe.ok) return
  } catch {
    return
  }

  let synced = 0
  for (const c of realChats) {
    try {
      const id = await legacyIdToUuid(c.id)
      idMap.set(c.id, id)
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id,
          title: c.title,
          model: c.model || null,
          modality: c.modality ?? 'text',
          // localStorage projects use legacy ids, not UUIDs — we leave the
          // chat unlinked at first. Drag-drop in the sidebar then links it
          // to a real DB project.
          project_id: null,
        }),
      })
      if (res.ok) synced++
    } catch {
      /* keep going — non-fatal */
    }
  }

  if (synced > 0) {
    console.log(`[v0] chat-sync: pushed ${synced} chat(s) to DB`)
  }
  sessionStorage.setItem(SESSION_FLAG, '1')

  // Let listeners (e.g. the sidebar) know we're done so they can refresh.
  window.dispatchEvent(new Event('clox-chats-synced'))
}
