'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Palette } from '@/shared/ui/chat/palettes'
import {
  deleteFile,
  ext,
  formatBytes,
  groupFiles,
  useFiles,
  type Deliverable,
  type FileCategory,
} from '@/lib/files-client'
import PdfThumb from '@/shared/ui/components/PdfThumb'
import FilePreview from './FilePreview'

type Filter = 'all' | FileCategory

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'deck', label: 'Decks' },
  { id: 'document', label: 'Documents' },
  { id: 'sheet', label: 'Sheets' },
  { id: 'image', label: 'Images' },
  { id: 'media', label: 'Video & audio' },
  { id: 'other', label: 'Other' },
]

function TypeTile({ item, p, mono }: { item: Deliverable; p: Palette; mono: string }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: mono, fontSize: 22, letterSpacing: '0.14em', color: p.inkMuted, border: `1px solid ${p.hairline}`, padding: '10px 14px', borderRadius: 2 }}>
        {ext(item.primary.filename).toUpperCase() || 'FILE'}
      </span>
    </div>
  )
}

const snippets = new Map<string, string>()

/** First lines of a small CSV / text file, drawn like a page. */
function TextThumb({ url, size, fallback, p, mono }: { url: string; size: number; fallback: ReactNode; p: Palette; mono: string }) {
  const [text, setText] = useState<string | null>(() => snippets.get(url) ?? null)
  useEffect(() => {
    if (text !== null || size > 256 * 1024) return
    const ctrl = new AbortController()
    fetch(url, { signal: ctrl.signal })
      .then(r => (r.ok ? r.text() : ''))
      .then(t => {
        const s = t.split('\n').slice(0, 9).map(l => l.slice(0, 80)).join('\n')
        snippets.set(url, s)
        setText(s)
      })
      .catch(() => undefined)
    return () => ctrl.abort()
  }, [url, size, text])
  if (!text) return <>{fallback}</>
  return (
    <pre style={{ margin: 0, padding: '14px 16px', height: '100%', overflow: 'hidden', fontFamily: mono, fontSize: 11, lineHeight: 1.6, color: p.inkSoft, whiteSpace: 'pre' }}>
      {text.replace(/,/g, '   ')}
    </pre>
  )
}

function Thumb({ item, p, mono }: { item: Deliverable; p: Palette; mono: string }) {
  const pv = item.preview
  const fallback = <TypeTile item={item} p={p} mono={mono} />
  if (!pv) return fallback
  if (item.previewKind === 'table' || item.previewKind === 'text') {
    return <TextThumb url={pv.url} size={pv.size} fallback={fallback} p={p} mono={mono} />
  }
  if (item.previewKind === 'pdf') return <PdfThumb url={pv.url} alt={`First page of ${item.title}`} fallback={fallback} />
  if (item.previewKind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pv.url} alt={item.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  }
  if (item.previewKind === 'video') {
    return <video src={`${pv.url}#t=0.5`} muted playsInline preload="metadata" aria-label={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  }
  return fallback
}

export default function FilesLibrary({
  p, mono, serif, chatTitles, onOpenChat,
}: {
  p: Palette
  mono: string
  serif: string
  chatTitles: Map<string, string>
  onOpenChat: (chatId: string) => void
}) {
  const { files, error, loading } = useFiles()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const items = useMemo(() => groupFiles(files ?? []), [files])
  const counts = useMemo(() => {
    const c = new Map<Filter, number>([['all', items.length]])
    for (const it of items) c.set(it.category, (c.get(it.category) ?? 0) + 1)
    return c
  }, [items])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(it =>
      (filter === 'all' || it.category === filter) &&
      (!q || it.title.toLowerCase().includes(q) || it.files.some(f => f.filename.toLowerCase().includes(q)) ||
        (chatTitles.get(it.chatId) ?? '').toLowerCase().includes(q)),
    )
  }, [items, filter, query, chatTitles])
  const open = openKey ? items.find(i => i.key === openKey) ?? null : null

  return (
    <div data-omma-page style={{ padding: '28px 56px 64px', maxWidth: 1180, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${p.hairlineSoft}`, flexWrap: 'wrap' }}>
        <div role="tablist" aria-label="File type" style={{ display: 'flex', flexWrap: 'wrap', fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          {FILTERS.filter(f => f.id === 'all' || counts.get(f.id)).map(f => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 12px',
                color: filter === f.id ? p.ink : p.inkMuted,
                borderBottom: `2px solid ${filter === f.id ? p.accent : 'transparent'}`,
              }}
            >
              {f.label} <span style={{ opacity: 0.6 }}>{counts.get(f.id) ?? 0}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <label style={{ position: 'relative' }}>
          <span className="sr-only">Search files</span>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search files…"
            style={{ width: 240, padding: '9px 12px', border: `1px solid ${p.hairline}`, borderRadius: 2, background: p.surface, color: p.ink, fontSize: 13, outline: 'none' }}
          />
        </label>
      </div>

      {error && !files && (
        <p role="alert" style={{ color: p.accent, fontSize: 13 }}>{error}</p>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} aria-hidden style={{ aspectRatio: '16 / 12', border: `1px solid ${p.hairlineSoft}`, borderRadius: 3, background: p.surface, animation: 'cloxPulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div style={{ border: `1px solid ${p.hairline}`, borderRadius: 3, background: p.surface, padding: '48px 32px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontFamily: serif, fontStyle: 'italic', fontSize: 22, color: p.ink }}>
            {items.length ? 'Nothing matches' : 'No files yet'}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: p.inkMuted }}>
            {items.length
              ? 'Try another type or search.'
              : 'Decks, reports, spreadsheets and images you make in a chat appear here.'}
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 20 }}>
          {shown.map(it => {
            const chatTitle = chatTitles.get(it.chatId)
            return (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => setOpenKey(it.key)}
                  aria-label={`Preview ${it.title}`}
                  style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left', padding: 0, cursor: 'pointer', background: p.surface, color: p.ink, border: `1px solid ${p.hairline}`, borderRadius: 3, overflow: 'hidden' }}
                >
                  <div style={{ aspectRatio: '16 / 10', width: '100%', background: p.surfaceAlt, borderBottom: `1px solid ${p.hairlineSoft}`, overflow: 'hidden' }}>
                    <Thumb item={it} p={p} mono={mono} />
                  </div>
                  <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                    <span style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontFamily: mono, fontSize: 10, letterSpacing: '0.08em', color: p.inkMuted }}>
                      {it.files.map(f => (
                        <span key={f.path} style={{ border: `1px solid ${p.hairline}`, padding: '1px 5px', borderRadius: 2, color: p.inkSoft }}>
                          {ext(f.filename).toUpperCase() || 'FILE'}
                        </span>
                      ))}
                      <span>{formatBytes(it.size)}</span>
                      <span aria-hidden>·</span>
                      <span>{new Date(it.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </span>
                    {chatTitle && (
                      <span style={{ fontSize: 12, color: p.inkMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chatTitle}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {open && (
        <FilePreview
          item={open}
          p={p}
          mono={mono}
          serif={serif}
          chatTitle={chatTitles.get(open.chatId) ?? null}
          onOpenChat={() => onOpenChat(open.chatId)}
          onDelete={async () => {
            for (const f of open.files) await deleteFile(f.path)
            setOpenKey(null)
          }}
          onClose={() => setOpenKey(null)}
        />
      )}
    </div>
  )
}
