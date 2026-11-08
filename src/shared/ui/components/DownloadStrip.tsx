/**
 * DownloadStrip — renders one chip per file produced by the sandbox
 * during an assistant turn. Each chip is a real `<a download>` link
 * pointing at a short-lived signed URL from the `chat-outputs`
 * Supabase Storage bucket.
 *
 * The strip styling mirrors the tool-call pills above the chat body
 * so the run-and-result feel like a single thread: the model
 * announced what it was doing, then the artifacts it produced.
 *
 * Visual hierarchy (intentional):
 *   <tool-call pills>   ← shown when the model called bash/python
 *   <model prose body>  ← the answer
 *   <download chips>    ← what to click to grab the deliverable
 *
 * The chip layout uses flexbox + `flex-wrap` so a long list of
 * outputs (e.g. "split this PDF into 12 pages") wraps gracefully on
 * narrow viewports.
 */

import React from 'react'
import { downloadUrl, stableFileUrl } from '@/lib/storage/file-url'
import PdfThumb from './PdfThumb'

export interface DownloadStripFile {
  filename: string
  url: string
  mime: string
  size: number
}

/** Format a byte size for the chip's secondary line. We deliberately
 *  keep this simple — no localisation, no IEC vs SI debate — because
 *  the chip has limited horizontal real estate. */
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** Best-guess label for the format chip ("PDF", "DOCX", "XLSX"). The
 *  filename's extension is the most reliable source — mime types vary
 *  per generator and several skills produce mime-less binaries. */
function formatTag(filename: string, mime: string): string {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (ext) return ext.toUpperCase()
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('word')) return 'DOCX'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'XLSX'
  if (mime.includes('presentation')) return 'PPTX'
  return 'FILE'
}

type PreviewKind = 'pdf' | 'image' | 'html'

function previewKind(f: DownloadStripFile): PreviewKind | null {
  const ext = f.filename.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf' || f.mime.includes('pdf')) return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || f.mime.startsWith('image/')) return 'image'
  if (ext === 'html' || ext === 'htm') return 'html'
  return null
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '').toLowerCase()

/** What to show when a chip's preview is opened. A deck or document is
 *  previewed through the PDF the kit writes beside it (deck.pptx → deck.pdf),
 *  because browsers can't draw .pptx/.docx themselves. */
function previewTarget(f: DownloadStripFile, files: DownloadStripFile[]): { file: DownloadStripFile; kind: PreviewKind } | null {
  const own = previewKind(f)
  if (own) return { file: f, kind: own }
  const twin = files.find(o => o !== f && previewKind(o) === 'pdf' && baseName(o.filename) === baseName(f.filename))
  return twin ? { file: twin, kind: 'pdf' } : null
}

function Preview({ file, kind, onClose }: { file: DownloadStripFile; kind: PreviewKind; onClose: () => void }) {
  return (
    <figure
      style={{
        margin: '10px 0 0', border: '1px solid currentColor', borderRadius: 6,
        overflow: 'hidden', width: '100%', maxWidth: 760,
      }}
    >
      <figcaption
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '6px 10px', borderBottom: '1px solid currentColor',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Preview · {file.filename}
        </span>
        <span style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
          <a href={file.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>Open full size</a>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 0, padding: 0, color: 'inherit', cursor: 'pointer', font: 'inherit' }}
          >
            Hide
          </button>
        </span>
      </figcaption>
      {kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.url} alt={`Preview of ${file.filename}`} style={{ display: 'block', width: '100%', height: 'auto' }} />
      ) : (
        <iframe
          title={`Preview of ${file.filename}`}
          src={kind === 'pdf' ? `${file.url}#view=FitH&navpanes=0` : file.url}
          sandbox={kind === 'html' ? 'allow-scripts' : undefined}
          style={{ display: 'block', width: '100%', height: kind === 'pdf' ? 460 : 520, border: 0, background: '#fff' }}
        />
      )}
    </figure>
  )
}

export function DownloadStrip({ files, defaultPreview = false }: { files: DownloadStripFile[]; defaultPreview?: boolean }) {
  const list = (Array.isArray(files) ? files : []).map(f => ({ ...f, url: stableFileUrl(f.url) }))
  // Open the first previewable deliverable on the newest turn, so a deck can be
  // checked and amended in the chat without downloading it each time.
  const firstPreviewable = list.findIndex(f => previewTarget(f, list))
  const [openIndex, setOpenIndex] = React.useState<number | null>(
    defaultPreview && firstPreviewable >= 0 ? firstPreviewable : null,
  )
  if (list.length === 0) return null
  const open = openIndex !== null ? previewTarget(list[openIndex], list) : null
  return (
    <div style={{ marginTop: 8 }}>
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
      }}
    >
      {list.map((f, i) => {
        const target = previewTarget(f, list)
        const canPreview = target !== null
        const visual = target && (target.kind === 'pdf' || target.kind === 'image') ? target : null
        return (
        <div key={`${f.filename}-${i}`} style={{ display: 'inline-flex', alignItems: 'stretch', gap: 0 }}>
        {visual && (
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-pressed={openIndex === i}
            aria-label={`${openIndex === i ? 'Hide' : 'Show'} preview of ${f.filename}`}
            style={{
              width: 84, padding: 0, border: '1px solid currentColor', borderRight: 0,
              borderRadius: '2px 0 0 2px', background: 'rgb(127 127 127 / 0.08)',
              cursor: 'pointer', overflow: 'hidden', position: 'relative',
              outline: openIndex === i ? '2px solid currentColor' : 'none', outlineOffset: -3,
            }}
          >
            {visual.kind === 'pdf' ? (
              <PdfThumb url={visual.file.url} alt="" fallback={<span style={{ fontSize: 10 }}>Preview</span>} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={visual.file.url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
          </button>
        )}
        {canPreview && !visual && (
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-pressed={openIndex === i}
            aria-label={`${openIndex === i ? 'Hide' : 'Show'} preview of ${f.filename}`}
            style={{
              padding: '0 10px', border: '1px solid currentColor', borderRight: 0,
              borderRadius: '2px 0 0 2px', background: 'transparent',
              color: 'inherit', cursor: 'pointer',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 10,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              textDecoration: openIndex === i ? 'underline' : 'none', textUnderlineOffset: 3,
            }}
          >
            {openIndex === i ? 'Hide' : 'Preview'}
          </button>
        )}
        <a
          href={downloadUrl(f.url)}
          download={f.filename}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex', flexDirection: 'column', gap: 2,
            padding: '6px 10px',
            border: '1px solid currentColor',
            borderRadius: canPreview ? '0 2px 2px 0' : 2,
            opacity: 0.95,
            textDecoration: 'none',
            color: 'inherit',
            fontSize: 12,
            maxWidth: 280,
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            }}
          >
            <span>↓ download</span>
            <span style={{ opacity: 0.75 }}>{formatTag(f.filename, f.mime)}</span>
          </div>
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: 11,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={f.filename}
          >
            {f.filename}
          </div>
          <div style={{ opacity: 0.7, fontSize: 10 }}>
            {formatBytes(f.size)}
          </div>
        </a>
        </div>
        )
      })}
    </div>
    {open && <Preview key={open.file.url} file={open.file} kind={open.kind} onClose={() => setOpenIndex(null)} />}
    </div>
  )
}
