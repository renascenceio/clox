'use client'

import { useEffect, useRef, useState } from 'react'
import type { Palette } from '@/shared/ui/chat/palettes'
import { downloadUrl } from '@/lib/storage/file-url'
import { ext, formatBytes, type Deliverable } from '@/lib/files-client'

const MAX_TEXT = 200_000
const MAX_ROWS = 200

function parseDelimited(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length && rows.length < MAX_ROWS + 1; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function TextBody({ url, table, p, mono }: { url: string; table: boolean; p: Palette; mono: string }) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    fetch(url, { signal: ctrl.signal })
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(`Could not load the file (${r.status})`))))
      .then(t => setText(t.slice(0, MAX_TEXT)))
      .catch(e => { if (!ctrl.signal.aborted) setError((e as Error).message) })
    return () => ctrl.abort()
  }, [url])
  if (error) return <p style={{ padding: 24, color: p.inkMuted }}>{error}</p>
  if (text === null) return <p style={{ padding: 24, color: p.inkMuted, fontFamily: mono, fontSize: 12 }}>Loading…</p>
  if (!table) {
    return (
      <pre style={{ margin: 0, padding: 24, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: mono, fontSize: 12.5, lineHeight: 1.6, color: p.ink }}>
        {text}
      </pre>
    )
  }
  const rows = parseDelimited(text, url.toLowerCase().includes('.tsv') ? '\t' : ',')
  const [head, ...body] = rows
  return (
    <div style={{ overflow: 'auto', padding: 16 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, color: p.ink, minWidth: '100%' }}>
        {head && (
          <thead>
            <tr>{head.map((h, i) => (
              <th key={i} scope="col" style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${p.hairline}`, fontFamily: mono, fontSize: 11, letterSpacing: '0.06em', color: p.inkSoft, whiteSpace: 'nowrap' }}>{h}</th>
            ))}</tr>
          </thead>
        )}
        <tbody>
          {body.slice(0, MAX_ROWS).map((r, i) => (
            <tr key={i}>{r.map((c, j) => (
              <td key={j} style={{ padding: '7px 12px', borderBottom: `1px solid ${p.hairlineSoft}`, whiteSpace: 'nowrap' }}>{c}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
      {body.length > MAX_ROWS && (
        <p style={{ fontFamily: mono, fontSize: 11, color: p.inkMuted, marginTop: 12 }}>
          Showing the first {MAX_ROWS} rows — download for the rest.
        </p>
      )}
    </div>
  )
}

export default function FilePreview({
  item, p, mono, serif, chatTitle, onOpenChat, onDelete, onClose,
}: {
  item: Deliverable
  p: Palette
  mono: string
  serif: string
  chatTitle: string | null
  onOpenChat: () => void
  onDelete: () => Promise<void>
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pv = item.preview
  const kind = item.previewKind
  const btn = {
    fontFamily: mono, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase' as const,
    padding: '7px 11px', border: `1px solid ${p.hairline}`, borderRadius: 2, background: 'transparent',
    color: p.ink, cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' as const,
  }

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgb(0 0 0 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${item.title}`}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 1080, maxHeight: '100%', display: 'flex', flexDirection: 'column', background: p.surface, color: p.ink, border: `1px solid ${p.hairline}`, borderRadius: 4, overflow: 'hidden' }}
      >
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px 20px', borderBottom: `1px solid ${p.hairline}`, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 0 }}>
            <h2 style={{ margin: 0, fontFamily: serif, fontSize: 22, fontWeight: 400, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h2>
            <p style={{ margin: '4px 0 0', fontFamily: mono, fontSize: 10.5, color: p.inkMuted, letterSpacing: '0.04em' }}>
              {new Date(item.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {' · '}{formatBytes(item.size)}
              {chatTitle ? ` · from “${chatTitle}”` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {item.files.map(f => (
              <a key={f.path} href={downloadUrl(f.url)} download={f.filename} style={btn}>
                Download {ext(f.filename).toUpperCase() || 'file'}
              </a>
            ))}
            <button type="button" onClick={onOpenChat} style={btn}>Open chat</button>
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                if (!window.confirm(`Delete “${item.title}”${item.files.length > 1 ? ` (${item.files.length} files)` : ''}? This can't be undone.`)) return
                setDeleting(true)
                try { await onDelete() } catch (e) { window.alert((e as Error).message); setDeleting(false) }
              }}
              style={{ ...btn, color: p.accent }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button ref={closeRef} type="button" onClick={onClose} aria-label="Close preview" style={{ ...btn, padding: '7px 10px' }}>Close</button>
          </div>
        </header>

        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: kind === 'pdf' || kind === 'html' ? '#fff' : p.bg }}>
          {!pv || !kind ? (
            <div style={{ padding: '72px 24px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontFamily: serif, fontStyle: 'italic', fontSize: 20 }}>No preview for .{ext(item.primary.filename)} files</p>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: p.inkMuted }}>Download it to open in Word, Excel or PowerPoint.</p>
            </div>
          ) : kind === 'pdf' ? (
            <iframe title={`Preview of ${item.title}`} src={`${pv.url}#view=FitH&navpanes=0`} style={{ display: 'block', width: '100%', height: '75vh', border: 0 }} />
          ) : kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pv.url} alt={item.title} style={{ display: 'block', maxWidth: '100%', maxHeight: '75vh', margin: '0 auto', objectFit: 'contain' }} />
          ) : kind === 'video' ? (
            <video src={pv.url} controls style={{ display: 'block', width: '100%', maxHeight: '75vh', background: '#000' }} />
          ) : kind === 'audio' ? (
            <div style={{ padding: 32 }}><audio src={pv.url} controls style={{ width: '100%' }} /></div>
          ) : kind === 'html' ? (
            <iframe title={`Preview of ${item.title}`} src={pv.url} sandbox="allow-scripts" style={{ display: 'block', width: '100%', height: '75vh', border: 0 }} />
          ) : (
            <TextBody url={pv.url} table={kind === 'table'} p={p} mono={mono} />
          )}
        </div>
      </div>
    </div>
  )
}
