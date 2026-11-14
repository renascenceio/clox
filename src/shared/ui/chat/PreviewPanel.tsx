'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, ExternalLink, X } from 'lucide-react'
import { downloadUrl } from '@/lib/storage/file-url'
import {
  formatBytes, formatTag, isTwinPreview, kindLabel, previewTarget,
} from '@/shared/ui/components/file-preview'
import type { Palette } from './palettes'
import { closePreview, selectPreview, usePreview } from './preview-store'
import FontPicker from './FontPicker'

const WIDTH_KEY = 'clox_preview_width'
/** Files whose fonts the kit sets: decks, reports, documents. */
const FONT_FILE = /\.(pptx|pdf|docx)$/i
const MIN_WIDTH = 360

/** Room the left rail takes, and the least the chat should keep. */
const RAIL = 248
const CHAT_MIN = 440

function clampWidth(w: number) {
  const max = Math.max(MIN_WIDTH, Math.min(1100, window.innerWidth - RAIL - CHAT_MIN))
  return Math.round(Math.min(max, Math.max(MIN_WIDTH, w)))
}

function useNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return narrow
}

const PANEL_CSS = `
.clox-pv-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-width:32px;padding:0 8px;border:0;border-radius:999px;background:transparent;color:inherit;font:inherit;font-size:12.5px;cursor:pointer;text-decoration:none;opacity:.72;transition:background .15s ease,opacity .15s ease}
.clox-pv-btn:hover{opacity:1;background:color-mix(in oklab,currentColor 9%,transparent)}
.clox-pv-primary{opacity:1;padding:0 14px;font-weight:500}
.clox-pv-tab{border:0;background:transparent;color:inherit;font:inherit;font-size:12.5px;padding:6px 12px;border-radius:999px;cursor:pointer;opacity:.6;white-space:nowrap;transition:background .15s ease,opacity .15s ease}
.clox-pv-tab:hover{opacity:.9}
.clox-pv-tab[aria-selected=true]{opacity:1;background:color-mix(in oklab,currentColor 9%,transparent)}
.clox-pv-btn:focus-visible,.clox-pv-tab:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.clox-pv-grip{position:absolute;left:-4px;top:0;bottom:0;width:8px;cursor:col-resize;z-index:2}
.clox-pv-grip::after{content:"";position:absolute;left:3px;top:50%;width:2px;height:40px;margin-top:-20px;border-radius:2px;background:currentColor;opacity:0;transition:opacity .15s ease}
.clox-pv-grip:hover::after,.clox-pv-grip[data-drag=true]::after{opacity:.35}
`

/** Side panel beside the chat that shows the file a reply made — like an
 *  artifact view. The chat keeps scrolling on the left. */
export default function PreviewPanel({ p }: { p: Palette }) {
  const preview = usePreview()
  const narrow = useNarrow()
  const [width, setWidth] = useState(640)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef<{ x: number; w: number } | null>(null)

  useEffect(() => {
    const saved = Number(localStorage.getItem(WIDTH_KEY))
    setWidth(clampWidth(saved > 0 ? saved : Math.min(720, (window.innerWidth - RAIL) * 0.5)))
    const onResize = () => setWidth(w => clampWidth(w))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return
      closePreview()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  if (!preview) return null
  const { files, index } = preview
  const file = files[index]
  if (!file) return null
  const target = previewTarget(file, files)
  const tabs = files.map((f, i) => ({ f, i })).filter(({ f }) => !isTwinPreview(f, files) || f === file)
  const twin = target && target.file !== file ? target.file : null
  const meta = [kindLabel(file.filename, file.mime), formatBytes(file.size)].filter(Boolean).join(' · ')

  const onGripDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = { x: e.clientX, w: width }
    setDragging(true)
  }
  const onGripMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return
    setWidth(clampWidth(startRef.current.w + (startRef.current.x - e.clientX)))
  }
  const onGripUp = () => {
    if (!startRef.current) return
    startRef.current = null
    setDragging(false)
    localStorage.setItem(WIDTH_KEY, String(width))
  }

  return (
    <aside
      aria-label={`Preview of ${file.filename}`}
      style={{
        position: narrow ? 'fixed' : 'relative',
        inset: narrow ? 0 : undefined,
        zIndex: narrow ? 60 : 1,
        width: narrow ? '100%' : width,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: p.surface,
        color: p.ink,
        boxShadow: narrow ? 'none' : '-18px 0 40px -28px rgba(0,0,0,0.35)',
        animation: 'cloxPreviewIn .22s ease',
      }}
    >
      <style>{`${PANEL_CSS}@keyframes cloxPreviewIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}`}</style>
      {!narrow && (
        <div
          className="clox-pv-grip"
          data-drag={dragging}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize preview"
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
        />
      )}

      <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 10px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
          <h2
            title={file.filename}
            style={{ margin: 0, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {file.filename}
          </h2>
          <span style={{ fontSize: 12, color: p.inkMuted }}>
            {meta}{twin ? ' · shown as PDF' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {FONT_FILE.test(file.filename) && <FontPicker key={file.url} filename={file.filename} p={p} />}
          {twin && (
            <a className="clox-pv-btn" href={downloadUrl(twin.url)} download={twin.filename} target="_blank" rel="noreferrer">
              PDF
            </a>
          )}
          <a
            className="clox-pv-btn clox-pv-primary"
            href={downloadUrl(file.url)}
            download={file.filename}
            target="_blank"
            rel="noreferrer"
            style={{ background: p.ink, color: p.surface }}
          >
            <Download size={15} strokeWidth={1.9} aria-hidden />
            {formatTag(file.filename, file.mime)}
          </a>
          {target && (
            <a
              className="clox-pv-btn"
              href={target.file.url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open in a new tab"
              title="Open in a new tab"
            >
              <ExternalLink size={16} strokeWidth={1.8} aria-hidden />
            </a>
          )}
          <button type="button" className="clox-pv-btn" onClick={closePreview} aria-label="Close preview" title="Close (Esc)">
            <X size={17} strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      </header>

      {tabs.length > 1 && (
        <div role="tablist" aria-label="Files from this reply" style={{ display: 'flex', gap: 2, padding: '0 14px 8px', overflowX: 'auto' }}>
          {tabs.map(({ f, i }) => (
            <button
              key={f.url}
              type="button"
              role="tab"
              aria-selected={i === index}
              className="clox-pv-tab"
              onClick={() => selectPreview(i)}
            >
              {f.filename}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, padding: '0 12px 12px', display: 'flex' }}>
        <div
          style={{
            flex: 1, minWidth: 0, borderRadius: 12, overflow: 'hidden',
            background: target ? '#fff' : 'color-mix(in oklab, currentColor 4%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            // The iframe swallows pointer moves; keep the drag smooth.
            pointerEvents: dragging ? 'none' : undefined,
          }}
        >
          {target?.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={target.file.url} alt={`Preview of ${file.filename}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
          ) : target ? (
            <iframe
              key={target.file.url}
              title={`Preview of ${file.filename}`}
              src={target.kind === 'pdf' ? `${target.file.url}#view=FitH&navpanes=0` : target.file.url}
              sandbox={target.kind === 'html' ? 'allow-scripts' : undefined}
              style={{ display: 'block', width: '100%', height: '100%', border: 0 }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 24, textAlign: 'center' }}>
              <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12, letterSpacing: '0.08em', color: p.inkMuted }}>
                {formatTag(file.filename, file.mime)}
              </span>
              <span style={{ fontSize: 13, color: p.inkSoft, maxWidth: 260, lineHeight: 1.5 }}>
                This kind of file can&apos;t be shown here. Download it to open it.
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
