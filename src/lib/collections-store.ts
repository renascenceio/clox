'use client'

/**
 * Gallery collections — client-side store.
 *
 * Users group their own generations into named collections (think albums)
 * inside the Gallery surface. A collection is just an ordered list of
 * pointers (`chatId` + `itemId` + `kind`); the underlying generation lives
 * in its chat-history bucket as before. That keeps collections cheap to
 * mutate, robust to permanent deletion (we filter dangling refs at read
 * time), and avoids duplicating large media payloads.
 *
 * Storage:
 *   clox_collections — JSON array of `Collection`
 */

import type { Modality } from './chat-store'

export type CollectionKind = 'image' | 'video' | 'audio' | 'mixed'

export interface CollectionRef {
  /** Modality of the underlying chat ('image' | 'video' | 'audio'). */
  kind: Exclude<Modality, 'text'>
  /** The chat that owns the generation in its history array. */
  chatId: string
  /** Stable id of the generation (when present). Older items don't have an
   *  id, so we fall back to URL matching during render. */
  itemId?: string
  /** URL of the underlying media — used as a fallback identity when itemId
   *  is missing. Stored at add-time so we can de-dupe robustly. */
  url?: string
  /** Wall-clock time the user added this ref to the collection. */
  addedAt: number
}

export interface Collection {
  id: string
  name: string
  /** What kinds of items live in this collection. `mixed` is allowed and
   *  surfaces in every gallery sub-tab. */
  kind: CollectionKind
  refs: CollectionRef[]
  createdAt: number
  /** Hex color (e.g. `#4b6584`) — purely cosmetic, used for the chip on
   *  collection cards. Optional. */
  accent?: string
}

const KEY = 'clox_collections'

export function listCollections(): Collection[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Collection[]) : []
  } catch { return [] }
}

function save(list: Collection[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, JSON.stringify(list))
  window.dispatchEvent(new CustomEvent('clox-collections-changed'))
}

export function createCollection(input: {
  name: string
  kind?: CollectionKind
  accent?: string
}): Collection {
  const c: Collection = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: (input.name || 'Untitled').slice(0, 80).trim() || 'Untitled',
    kind: input.kind ?? 'mixed',
    refs: [],
    createdAt: Date.now(),
    accent: input.accent,
  }
  save([c, ...listCollections()])
  return c
}

export function renameCollection(id: string, name: string): void {
  save(listCollections().map(c => (c.id === id ? { ...c, name: name.slice(0, 80) } : c)))
}

export function deleteCollection(id: string): void {
  save(listCollections().filter(c => c.id !== id))
}

/**
 * Add a generation to a collection. Idempotent: if the same (chatId, itemId
 * or url) pair is already in the collection, this is a no-op so the user
 * never sees duplicates.
 *
 * Also widens the collection's `kind` to `mixed` if a different-kind
 * generation joins, so collection filtering stays accurate.
 */
export function addToCollection(
  collectionId: string,
  ref: Omit<CollectionRef, 'addedAt'>,
): void {
  const list = listCollections()
  const idx = list.findIndex(c => c.id === collectionId)
  if (idx === -1) return
  const c = list[idx]
  const exists = c.refs.some(r =>
    r.chatId === ref.chatId &&
    ((ref.itemId && r.itemId === ref.itemId) || (ref.url && r.url === ref.url)),
  )
  if (exists) return
  const widenedKind: CollectionKind =
    c.kind === ref.kind || c.refs.length === 0
      ? (c.refs.length === 0 ? ref.kind : c.kind)
      : 'mixed'
  const next: Collection = {
    ...c,
    kind: widenedKind,
    refs: [{ ...ref, addedAt: Date.now() }, ...c.refs],
  }
  list[idx] = next
  save(list)
}

export function removeFromCollection(
  collectionId: string,
  match: { chatId: string; itemId?: string; url?: string },
): void {
  const list = listCollections()
  const idx = list.findIndex(c => c.id === collectionId)
  if (idx === -1) return
  const next = {
    ...list[idx],
    refs: list[idx].refs.filter(r => !(
      r.chatId === match.chatId &&
      ((match.itemId && r.itemId === match.itemId) || (match.url && r.url === match.url))
    )),
  }
  list[idx] = next
  save(list)
}

/** Convenience: collections of a given kind plus all `mixed` ones. */
export function listCollectionsForKind(kind: Exclude<Modality, 'text'> | 'all'): Collection[] {
  const all = listCollections()
  if (kind === 'all') return all
  return all.filter(c => c.kind === kind || c.kind === 'mixed')
}
