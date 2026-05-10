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

export function DownloadStrip({ files }: { files: DownloadStripFile[] }) {
  if (!Array.isArray(files) || files.length === 0) return null
  return (
    <div
      style={{
        display: 'flex', flexWrap: 'wrap', gap: 6,
        marginTop: 8,
      }}
    >
      {files.map((f, i) => (
        <a
          key={`${f.filename}-${i}`}
          href={f.url}
          download={f.filename}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex', flexDirection: 'column', gap: 2,
            padding: '6px 10px',
            border: '1px solid currentColor',
            borderRadius: 2,
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
      ))}
    </div>
  )
}
