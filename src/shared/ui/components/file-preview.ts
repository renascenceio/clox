/** What the chat knows about a file a reply produced, and how to preview it. */

export interface DownloadStripFile {
  filename: string
  url: string
  mime: string
  size: number
}

export type PreviewKind = 'pdf' | 'image' | 'html'

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function extensionOf(filename: string): string {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop() ?? '' : ''
}

/** "PDF", "PPTX"… from the extension first (mime types vary per generator). */
export function formatTag(filename: string, mime: string): string {
  const ext = extensionOf(filename)
  if (ext) return ext.toUpperCase()
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('word')) return 'DOCX'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'XLSX'
  if (mime.includes('presentation')) return 'PPTX'
  return 'FILE'
}

/** The kind of document in words, for the line under a file name. */
export function kindLabel(filename: string, mime: string): string {
  const tag = formatTag(filename, mime)
  const names: Record<string, string> = {
    PPTX: 'PowerPoint', PPT: 'PowerPoint', KEY: 'Keynote',
    DOCX: 'Word document', DOC: 'Word document',
    XLSX: 'Excel workbook', XLS: 'Excel workbook', CSV: 'CSV table',
    PDF: 'PDF', HTML: 'Web page', HTM: 'Web page', MD: 'Markdown', TXT: 'Text',
    PNG: 'Image', JPG: 'Image', JPEG: 'Image', GIF: 'Image', WEBP: 'Image', SVG: 'Image',
    ZIP: 'Archive', JSON: 'JSON',
  }
  return names[tag] ?? tag
}

export function previewKind(f: DownloadStripFile): PreviewKind | null {
  const ext = extensionOf(f.filename)
  if (ext === 'pdf' || f.mime.includes('pdf')) return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || f.mime.startsWith('image/')) return 'image'
  if (ext === 'html' || ext === 'htm') return 'html'
  return null
}

const baseName = (name: string) => name.replace(/\.[^.]+$/, '').toLowerCase()

/** What to draw when a file is opened. A deck or document is shown through
 *  the PDF the kit writes beside it (deck.pptx → deck.pdf), because browsers
 *  can't draw .pptx/.docx themselves. */
export function previewTarget(
  f: DownloadStripFile,
  files: DownloadStripFile[],
): { file: DownloadStripFile; kind: PreviewKind } | null {
  const own = previewKind(f)
  if (own) return { file: f, kind: own }
  const twin = files.find(o => o !== f && previewKind(o) === 'pdf' && baseName(o.filename) === baseName(f.filename))
  return twin ? { file: twin, kind: 'pdf' } : null
}

/** A PDF that only exists as another file's preview (deck.pdf beside
 *  deck.pptx). It stays downloadable, but the original leads. */
export function isTwinPreview(f: DownloadStripFile, files: DownloadStripFile[]): boolean {
  return previewKind(f) === 'pdf' &&
    files.some(o => o !== f && previewKind(o) === null && baseName(o.filename) === baseName(f.filename))
}
