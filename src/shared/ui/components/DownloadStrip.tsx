'use client'

/**
 * DownloadStrip — one quiet tile per file a reply produced. Clicking a
 * tile opens it in the side preview panel; the arrow downloads it. A deck's
 * PDF twin (deck.pdf beside deck.pptx) rides on the deck's tile instead of
 * getting its own.
 */

import React from 'react'
import { Download } from 'lucide-react'
import { downloadUrl, stableFileUrl } from '@/lib/storage/file-url'
import { autoOpened, openPreview, usePreview } from '@/shared/ui/chat/preview-store'
import PdfThumb from './PdfThumb'
import {
  formatBytes, formatTag, isTwinPreview, kindLabel, previewTarget,
  type DownloadStripFile,
} from './file-preview'

export type { DownloadStripFile } from './file-preview'

const TILE_CSS = `
.clox-file{display:flex;align-items:center;gap:12px;min-width:0;width:100%;max-width:380px;padding:8px 8px 8px 8px;border-radius:14px;background:color-mix(in oklab,currentColor 5%,transparent);color:inherit;text-align:left;font:inherit;border:0;transition:background .15s ease}
.clox-file[data-open=true]{background:color-mix(in oklab,currentColor 10%,transparent)}
.clox-file:hover{background:color-mix(in oklab,currentColor 8%,transparent)}
.clox-file-main{display:flex;align-items:center;gap:12px;min-width:0;flex:1;background:none;border:0;padding:0;color:inherit;font:inherit;text-align:left;cursor:pointer;border-radius:10px}
.clox-file-main:disabled{cursor:default}
.clox-file-act{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-width:32px;padding:0 10px;border-radius:999px;color:inherit;text-decoration:none;font-size:12px;font-weight:500;opacity:.75;transition:background .15s ease,opacity .15s ease}
.clox-file-act:hover{opacity:1;background:color-mix(in oklab,currentColor 9%,transparent)}
.clox-file-main:focus-visible,.clox-file-act:focus-visible{outline:2px solid currentColor;outline-offset:2px}
`

function Thumb({ file, files }: { file: DownloadStripFile; files: DownloadStripFile[] }) {
  const target = previewTarget(file, files)
  const box: React.CSSProperties = {
    flexShrink: 0, borderRadius: 8, overflow: 'hidden',
    background: 'color-mix(in oklab, currentColor 7%, transparent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  if (target?.kind === 'pdf') {
    return (
      <span style={{ ...box, width: 72, height: 46, background: '#fff' }}>
        <PdfThumb url={target.file.url} alt="" fallback={<TagBadge file={file} />} />
      </span>
    )
  }
  if (target?.kind === 'image') {
    return (
      <span style={{ ...box, width: 46, height: 46 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={target.file.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </span>
    )
  }
  return <span style={{ ...box, width: 46, height: 46 }}><TagBadge file={file} /></span>
}

function TagBadge({ file }: { file: DownloadStripFile }) {
  return (
    <span style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', fontSize: 10, letterSpacing: '0.06em', opacity: 0.7 }}>
      {formatTag(file.filename, file.mime)}
    </span>
  )
}

export function DownloadStrip({ files, autoOpen = false }: { files: DownloadStripFile[]; autoOpen?: boolean }) {
  const all = React.useMemo(
    () => (Array.isArray(files) ? files : []).map(f => ({ ...f, url: stableFileUrl(f.url) })),
    [files],
  )
  const tiles = all.filter(f => !isTwinPreview(f, all))
  const preview = usePreview()
  const shownUrl = preview ? preview.files[preview.index]?.url : null

  const firstPreviewable = all.findIndex(f => !isTwinPreview(f, all) && previewTarget(f, all))
  const autoKey = firstPreviewable >= 0 ? all[firstPreviewable].url : ''
  React.useEffect(() => {
    if (!autoOpen || !autoKey || autoOpened.has(autoKey)) return
    autoOpened.add(autoKey)
    // On a phone the panel covers the chat, so it waits for a tap there.
    if (window.matchMedia('(max-width: 900px)').matches) return
    openPreview(all, firstPreviewable)
  }, [autoOpen, autoKey, all, firstPreviewable])

  if (tiles.length === 0) return null

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <style>{TILE_CSS}</style>
      {tiles.map(f => {
        const index = all.indexOf(f)
        const target = previewTarget(f, all)
        const twin = target && target.file !== f ? target.file : null
        const isOpen = shownUrl === f.url || (twin !== null && shownUrl === twin.url)
        const meta = [kindLabel(f.filename, f.mime), formatBytes(f.size)].filter(Boolean).join(' · ')
        return (
          <div key={f.url} className="clox-file" data-open={isOpen}>
            <button
              type="button"
              className="clox-file-main"
              disabled={!target}
              onClick={() => openPreview(all, index)}
              aria-label={target ? `Preview ${f.filename}` : f.filename}
              aria-pressed={target ? isOpen : undefined}
            >
              <Thumb file={f} files={all} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <span
                  title={f.filename}
                  style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {f.filename}
                </span>
                <span style={{ fontSize: 11.5, opacity: 0.6, whiteSpace: 'nowrap' }}>
                  {isOpen ? 'Showing in preview' : meta}
                </span>
              </span>
            </button>
            {twin && (
              <a
                className="clox-file-act"
                href={downloadUrl(twin.url)}
                download={twin.filename}
                target="_blank"
                rel="noreferrer"
                aria-label={`Download ${twin.filename}`}
                title={`Download ${twin.filename}`}
              >
                PDF
              </a>
            )}
            <a
              className="clox-file-act"
              href={downloadUrl(f.url)}
              download={f.filename}
              target="_blank"
              rel="noreferrer"
              aria-label={`Download ${f.filename}`}
              title={`Download ${f.filename}`}
            >
              <Download size={16} strokeWidth={1.8} aria-hidden />
            </a>
          </div>
        )
      })}
    </div>
  )
}
