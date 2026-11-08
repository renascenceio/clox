'use client'

/**
 * Client side of the Files library: loads `/api/files`, keeps the result
 * for the whole tab session (so coming back to the page is instant), and
 * groups twins — a deck's `.pptx` and the `.pdf` written beside it — into
 * one item.
 */

import { useEffect, useState } from 'react'

export interface StoredFile {
  path: string
  chatId: string
  filename: string
  mime: string
  size: number
  createdAt: string
  updatedAt: string
  url: string
}

export type FileCategory = 'deck' | 'document' | 'sheet' | 'image' | 'media' | 'other'
export type PreviewKind = 'pdf' | 'image' | 'video' | 'audio' | 'html' | 'table' | 'text' | null

export interface Deliverable {
  key: string
  title: string
  chatId: string
  files: StoredFile[]
  /** The file the item is named after (e.g. the .pptx, not its PDF twin). */
  primary: StoredFile
  /** The file used to draw the preview, if any can be drawn. */
  preview: StoredFile | null
  previewKind: PreviewKind
  category: FileCategory
  updatedAt: number
  size: number
}

export const ext = (name: string) => (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '')

const CATEGORY: Record<string, FileCategory> = {
  pptx: 'deck', ppt: 'deck', key: 'deck', odp: 'deck',
  pdf: 'document', docx: 'document', doc: 'document', md: 'document', txt: 'document',
  html: 'document', htm: 'document', rtf: 'document', json: 'document',
  xlsx: 'sheet', xls: 'sheet', csv: 'sheet', tsv: 'sheet', ods: 'sheet',
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', svg: 'image',
  mp4: 'media', webm: 'media', mov: 'media', mp3: 'media', wav: 'media', m4a: 'media', ogg: 'media',
}

/** Which file names a group: office formats beat their PDF twin. */
const PRIMARY_ORDER = ['pptx', 'ppt', 'key', 'docx', 'doc', 'xlsx', 'xls', 'pdf']

export function previewKindOf(f: StoredFile): PreviewKind {
  const e = ext(f.filename)
  if (e === 'pdf' || f.mime.includes('pdf')) return 'pdf'
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(e) || f.mime.startsWith('image/')) return 'image'
  if (['mp4', 'webm', 'mov'].includes(e) || f.mime.startsWith('video/')) return 'video'
  if (['mp3', 'wav', 'm4a', 'ogg'].includes(e) || f.mime.startsWith('audio/')) return 'audio'
  if (e === 'html' || e === 'htm') return 'html'
  if (e === 'csv' || e === 'tsv') return 'table'
  if (['md', 'txt', 'json'].includes(e) || f.mime.startsWith('text/')) return 'text'
  return null
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '')

function prettyTitle(name: string) {
  const base = baseName(name).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : name
}

export function groupFiles(files: StoredFile[]): Deliverable[] {
  const groups = new Map<string, StoredFile[]>()
  for (const f of files) {
    const key = `${f.chatId}/${baseName(f.filename).toLowerCase()}`
    const list = groups.get(key)
    if (list) list.push(f)
    else groups.set(key, [f])
  }
  const out: Deliverable[] = []
  for (const [key, list] of groups) {
    const rank = (f: StoredFile) => {
      const i = PRIMARY_ORDER.indexOf(ext(f.filename))
      return i < 0 ? PRIMARY_ORDER.length : i
    }
    const sorted = [...list].sort((a, b) => rank(a) - rank(b))
    const primary = sorted[0]
    const own = previewKindOf(primary)
    const pdfTwin = list.find(f => previewKindOf(f) === 'pdf')
    const preview = own ? primary : pdfTwin ?? null
    out.push({
      key,
      title: prettyTitle(primary.filename),
      chatId: primary.chatId,
      files: sorted,
      primary,
      preview,
      previewKind: preview ? previewKindOf(preview) : null,
      category: CATEGORY[ext(primary.filename)] ?? 'other',
      updatedAt: Math.max(...list.map(f => Date.parse(f.updatedAt) || 0)),
      size: list.reduce((n, f) => n + f.size, 0),
    })
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/* ------------------------------------------------------------------ */

type State = { files: StoredFile[] | null; error: string | null }
let cache: State = { files: null, error: null }
let inflight: Promise<void> | null = null
const listeners = new Set<(s: State) => void>()

function publish(next: State) {
  cache = next
  listeners.forEach(l => l(next))
}

export function refreshFiles(): Promise<void> {
  if (inflight) return inflight
  inflight = fetch('/api/files', { cache: 'no-store' })
    .then(async res => {
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || `Could not load files (${res.status})`)
      publish({ files: body.files ?? [], error: null })
    })
    .catch(e => publish({ files: cache.files, error: (e as Error).message }))
    .finally(() => { inflight = null })
  return inflight
}

/** Files list shared by every component; revalidates on mount and focus. */
export function useFiles() {
  const [state, setState] = useState<State>(cache)
  useEffect(() => {
    listeners.add(setState)
    refreshFiles()
    const onFocus = () => refreshFiles()
    window.addEventListener('focus', onFocus)
    return () => {
      listeners.delete(setState)
      window.removeEventListener('focus', onFocus)
    }
  }, [])
  return { ...state, loading: state.files === null && !state.error }
}

export async function deleteFile(path: string) {
  const res = await fetch('/api/files', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Could not delete the file')
  }
  publish({ files: (cache.files ?? []).filter(f => f.path !== path), error: null })
}
