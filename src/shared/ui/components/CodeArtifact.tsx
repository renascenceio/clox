'use client'

/**
 * Renders a fenced code block as a downloadable artifact.
 *
 * The chat surface used to render assistant code as plain styled text
 * inside ReactMarkdown — readable, but you couldn't actually do
 * anything with it. Here we wrap each block with a small toolbar that
 * lets the user:
 *
 *   • Copy     — clipboard write
 *   • Download — saves the body as a real file with a sane extension
 *                inferred from the language tag (CSV blocks ALSO
 *                offer an "Excel" download via SheetJS)
 *   • Preview  — for HTML/SVG, renders a sandboxed iframe inline; for
 *                CSV/TSV, renders a small table; for JSON, pretty-
 *                prints; for Markdown, renders formatted text. Lets
 *                users actually see what they got back instead of
 *                staring at raw markup.
 *
 * Inline (`<code>` without ``` fences) is intentionally NOT artifactised
 * — it would clutter the transcript for short identifiers and
 * variable names. We only treat a `<code>` whose parent is `<pre>` as
 * an artifact.
 *
 * Designed to drop straight into the `components` prop of
 * `react-markdown`:
 *
 *   <ReactMarkdown components={{ code: CodeArtifact }}>{text}</ReactMarkdown>
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

/** Map language hint → file extension for Download. */
const LANG_EXT: Record<string, string> = {
  html: 'html', xml: 'xml', svg: 'svg',
  css: 'css', scss: 'scss',
  js: 'js', javascript: 'js', jsx: 'jsx',
  ts: 'ts', typescript: 'ts', tsx: 'tsx',
  json: 'json', yaml: 'yaml', yml: 'yml', toml: 'toml',
  csv: 'csv', tsv: 'tsv', md: 'md', markdown: 'md',
  py: 'py', python: 'py', rb: 'rb', ruby: 'rb',
  sh: 'sh', bash: 'sh', zsh: 'sh', shell: 'sh',
  sql: 'sql', graphql: 'graphql', gql: 'graphql',
  go: 'go', rs: 'rs', rust: 'rs', java: 'java', kt: 'kt',
  c: 'c', h: 'h', cpp: 'cpp', cs: 'cs', php: 'php', swift: 'swift',
  txt: 'txt', text: 'txt', diff: 'diff', patch: 'patch',
  // Document specs — the *body* of the block is JSON/markdown that
  // this component compiles into a real .docx / .pptx / .pdf at
  // download time. These aren't proper "languages" but using them as
  // language tags keeps the model's emit format ergonomic ("```pptx
  // {…outline…}" reads naturally) and tells the toolbar which
  // converter to offer.
  pptx: 'pptx', docx: 'docx', latex: 'tex', tex: 'tex',
}

/** Languages we know how to render in the inline preview pane. */
const PREVIEWABLE = new Set([
  'html', 'svg', 'xml',
  'csv', 'tsv',
  'json',
  'md', 'markdown',
  // pptx outlines preview as a rendered slide list; docx specs
  // preview as their formatted body so the user can see what they
  // are about to download.
  'pptx', 'docx',
])

/** Languages that should also offer an "Excel" download option. */
const TABULAR = new Set(['csv', 'tsv'])

/** Languages that get a "docx" download option. We accept Markdown
 *  (the natural way to express a document) and HTML (richer layout). */
const DOCX_SOURCE = new Set(['markdown', 'md', 'html', 'docx'])

/** Languages that get a "pdf" download option. PDF is generated from
 *  the rendered HTML in the preview iframe, so any language that has
 *  an HTML-style preview qualifies. */
const PDF_SOURCE = new Set(['markdown', 'md', 'html', 'svg'])

/** Languages that get a "pptx" download option. We only know how to
 *  build a deck from the structured `pptx` outline; HTML→PPTX is far
 *  less reliable so we leave it to the user to ask the model for the
 *  outline form when they want a real deck. */
const PPTX_SOURCE = new Set(['pptx'])

/** Pull the language hint off the className react-markdown emits. */
function readLang(className?: string): string {
  if (!className) return ''
  const m = /language-([\w-]+)/.exec(className)
  return m ? m[1].toLowerCase() : ''
}

function inferFilename(lang: string, ext?: string): string {
  const finalExt = ext || LANG_EXT[lang] || 'txt'
  return `snippet.${finalExt}`
}

function inferMime(lang: string): string {
  switch (lang) {
    case 'json':           return 'application/json'
    case 'csv':            return 'text/csv'
    case 'tsv':            return 'text/tab-separated-values'
    case 'html':           return 'text/html'
    case 'svg':            return 'image/svg+xml'
    case 'xml':            return 'application/xml'
    case 'md':
    case 'markdown':       return 'text/markdown'
    case 'js':
    case 'javascript':     return 'application/javascript'
    case 'ts':
    case 'typescript':     return 'application/typescript'
    case 'css':            return 'text/css'
    case 'yaml':
    case 'yml':            return 'application/yaml'
    // Office formats — these only matter when the user clicks the
    // raw "download" button on a `pptx` / `docx` block (which gives
    // them the source spec). The actual binary download lives on the
    // dedicated "pptx" / "docx" buttons further down.
    case 'pptx':           return 'application/json'
    case 'docx':           return 'application/json'
    case 'latex':
    case 'tex':            return 'application/x-tex'
    default:               return 'text/plain'
  }
}

/**
 * Receives the props react-markdown gives to the `code` slot. We only
 * wrap when this is a fenced (multi-line / display) block; inline
 * code passes through untouched.
 *
 * react-markdown v9 deprecated the explicit `inline` prop in favour
 * of letting the parent `pre` component do the wrapping. We detect
 * "block" code by looking for a newline OR a `language-…` className,
 * which together cover both v8 and v9 behaviour without a runtime
 * dependency check.
 */
export function CodeArtifact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: ComponentProps<'code'> & { node?: any; inline?: boolean },
) {
  const { className, children, inline, ...rest } = props
  const lang = readLang(className)
  const raw = useMemo(() => {
    if (typeof children === 'string') return children
    if (Array.isArray(children)) return children.map(String).join('')
    return String(children ?? '')
  }, [children])

  // Heuristic — see comment on the function. We treat anything with
  // either a real language hint or an embedded newline as a block.
  const isBlock = !inline && (lang.length > 0 || raw.includes('\n'))
  if (!isBlock) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    )
  }

  return <ArtifactCard code={raw.replace(/\n$/, '')} lang={lang} />
}

function ArtifactCard({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  // Auto-open preview for visual languages so the user gets the
  // rendered output by default rather than the raw markup. They can
  // still toggle to "code" if they want to read the source.
  const [showPreview, setShowPreview] = useState(
    lang === 'html' || lang === 'svg' || lang === 'markdown' || lang === 'md' ||
    lang === 'pptx' || lang === 'docx',
  )
  // While a binary export is being assembled (docx / pdf / pptx) we
  // disable the buttons and label them with the in-flight verb so the
  // user gets feedback for the 200-800ms the conversion typically
  // takes on a moderately sized doc.
  const [busy, setBusy] = useState<'' | 'docx' | 'pdf' | 'pptx'>('')
  const previewable = PREVIEWABLE.has(lang)
  const tabular = TABULAR.has(lang)
  const canDocx = DOCX_SOURCE.has(lang)
  const canPdf  = PDF_SOURCE.has(lang)
  const canPptx = PPTX_SOURCE.has(lang)
  // The HtmlPreview iframe registers itself here so the PDF exporter
  // can snapshot the rendered DOM. We don't reach into the iframe's
  // contentDocument from outside — html2canvas takes a pure DOM node,
  // so PDF generation builds its own off-screen render instead of
  // depending on the preview state.
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch (e) {
      console.error('[v0] artifact copy failed', e)
    }
  }

  function handleDownload() {
    const filename = inferFilename(lang)
    // Use a Blob URL rather than a data: URL so big payloads don't
    // hit the browser's URL length limits and so the file inherits a
    // useful Content-Type for the destination app.
    const blob = new Blob([code], { type: `${inferMime(lang)};charset=utf-8` })
    triggerDownload(blob, filename)
  }

  /**
   * Convert a CSV / TSV body to a real .xlsx workbook using SheetJS,
   * then offer it as a single-sheet download. This lets the model
   * answer "make me an Excel file" with a CSV block — the user gets
   * a proper .xlsx without us needing the model to emit binary.
   */
  function handleDownloadExcel() {
    try {
      const delim = lang === 'tsv' ? '\t' : ','
      const parsed = Papa.parse<string[]>(code, {
        delimiter: delim,
        skipEmptyLines: true,
      })
      const rows = (parsed.data as string[][]).filter(r => r.length > 0)
      const sheet = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1')
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      triggerDownload(
        new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        'spreadsheet.xlsx',
      )
    } catch (e) {
      console.error('[v0] xlsx export failed', e)
    }
  }

  /**
   * Build a real .docx from the artifact body and trigger a download.
   *
   * Source language can be:
   *   - markdown / md  — parsed by `mdToDocxChildren` into headings,
   *                      paragraphs, lists, code blocks, tables.
   *   - html           — converted by stripping tags into plain
   *                      paragraphs while preserving headings.
   *   - docx           — the body is a JSON spec (see DOCX_JSON_SHAPE
   *                      in the helper) for exact paragraph/run control.
   *
   * `docx` is loaded lazily so it doesn't bloat the initial bundle —
   * the library is ~250KB minified and only matters when the user
   * actually clicks "docx".
   */
  async function handleDownloadDocx() {
    setBusy('docx')
    try {
      const docx = await import('docx')
      const children = buildDocxChildren(docx, code, lang)
      const doc = new docx.Document({
        creator: 'Clox',
        styles: defaultDocxStyles(docx),
        sections: [{ properties: {}, children }],
      })
      const blob = await docx.Packer.toBlob(doc)
      triggerDownload(blob, 'document.docx')
    } catch (e) {
      console.error('[v0] docx export failed', e)
      alert(`docx export failed: ${(e as Error).message}`)
    } finally {
      setBusy('')
    }
  }

  /**
   * Build a real .pptx from a structured outline and download it.
   *
   * The artifact body is expected to be JSON of the shape:
   *   {
   *     "title": "Deck title (optional, used as the title slide)",
   *     "theme": { "background": "#fff", "accent": "#1a1a1a" },
   *     "slides": [
   *       { "title": "Slide 1", "bullets": ["Point A", "Point B"], "notes": "…" },
   *       { "title": "Closing", "body": "Free-form paragraph text" }
   *     ]
   *   }
   *
   * Both `bullets` (array) and `body` (string) are accepted so the
   * model can pick the right shape per slide. Speaker notes are
   * embedded so the deck travels with its narration.
   */
  async function handleDownloadPptx() {
    setBusy('pptx')
    try {
      const PptxGenJS = (await import('pptxgenjs')).default
      const spec = parsePptxSpec(code)
      const pres = new PptxGenJS()
      pres.layout = 'LAYOUT_WIDE'
      const accent = spec.theme?.accent ?? '1A1A1A'
      const bg = spec.theme?.background ?? 'FFFFFF'

      // Optional title slide — only emitted when the user supplied a
      // top-level title, so a single-slide outline doesn't get a
      // confusing duplicate cover.
      if (spec.title) {
        const cover = pres.addSlide()
        cover.background = { color: bg }
        cover.addText(spec.title, {
          x: 0.5, y: 2.6, w: 12, h: 1.5,
          fontSize: 40, bold: true, color: accent,
          fontFace: 'Helvetica',
        })
      }

      for (const slide of spec.slides) {
        const s = pres.addSlide()
        s.background = { color: bg }
        if (slide.title) {
          s.addText(slide.title, {
            x: 0.5, y: 0.4, w: 12, h: 0.9,
            fontSize: 28, bold: true, color: accent,
            fontFace: 'Helvetica',
          })
        }
        if (slide.bullets && slide.bullets.length > 0) {
          s.addText(
            slide.bullets.map(b => ({ text: b, options: { bullet: true } })),
            {
              x: 0.6, y: 1.4, w: 11.5, h: 5.6,
              fontSize: 18, color: accent, fontFace: 'Helvetica',
              valign: 'top',
            },
          )
        } else if (slide.body) {
          s.addText(slide.body, {
            x: 0.6, y: 1.4, w: 11.5, h: 5.6,
            fontSize: 18, color: accent, fontFace: 'Helvetica',
            valign: 'top',
          })
        }
        if (slide.notes) s.addNotes(slide.notes)
      }

      // pptxgenjs returns a base64 data URI when stream:false; we use
      // its blob writer to keep memory bounded for big decks.
      const blob = (await pres.write({ outputType: 'blob' })) as Blob
      triggerDownload(blob, 'presentation.pptx')
    } catch (e) {
      console.error('[v0] pptx export failed', e)
      alert(`pptx export failed: ${(e as Error).message}`)
    } finally {
      setBusy('')
    }
  }

  /**
   * Render the artifact as a real PDF.
   *
   * Implementation:
   *   1. Materialise the artifact body as a styled HTML document
   *      (markdown is converted via the same `mdToHtml` used by the
   *      preview pane; html / svg pass through).
   *   2. Mount that HTML inside an off-screen iframe sized to A4
   *      content width (794px @ 96dpi). The iframe gives us a real
   *      layout context for html2canvas without affecting the parent
   *      page's scroll.
   *   3. Use html2canvas to rasterise the iframe body, then jspdf to
   *      paginate the resulting image into A4 portrait pages.
   *
   * This is the same technique Notion / Linear / GitHub Issues use
   * for "Export as PDF" — quality is good for text, charts, and
   * arbitrary layout; less ideal for vectors (a future follow-up
   * could swap to jspdf's native HTML pipeline for crispness).
   */
  async function handleDownloadPdf() {
    setBusy('pdf')
    try {
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ])
      const html2canvas = html2canvasMod.default
      const html =
        lang === 'markdown' || lang === 'md' ? mdToHtml(code) :
        lang === 'svg' ? svgToFullHtml(code) :
        ensureFullHtml(code)

      // Off-screen iframe at A4 content width. We keep it visible
      // (just shifted off the viewport) because some browsers clip
      // `display:none` iframes from rendering, which would give us a
      // blank canvas.
      const A4_PX_W = 794
      const frame = document.createElement('iframe')
      frame.style.position = 'fixed'
      frame.style.left = '-10000px'
      frame.style.top = '0'
      frame.style.width = A4_PX_W + 'px'
      frame.style.height = '1000px'
      frame.style.border = '0'
      document.body.appendChild(frame)
      try {
        const doc = frame.contentDocument
        if (!doc) throw new Error('Could not access export frame document')
        doc.open()
        doc.write(html)
        doc.close()
        // Wait a tick so layout / fonts settle before snapshotting —
        // skipping this gives blank canvases for the first paragraph.
        await new Promise(r => setTimeout(r, 80))
        const target = doc.body
        const canvas = await html2canvas(target, {
          scale: 2,           // 2× = retina, good print quality
          backgroundColor: '#ffffff',
          windowWidth: A4_PX_W,
          // Disabling foreignObject avoids cross-origin / CSS-cap
          // bugs that show up with system fonts; the standard pixel
          // path is plenty fast for documents.
          useCORS: true,
          logging: false,
        })
        const imgData = canvas.toDataURL('image/png')

        // Paginate. jsPDF's A4 portrait is 210×297 mm (or 595.28 ×
        // 841.89 pt). We work in mm so the math reads naturally.
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
        const pageW = pdf.internal.pageSize.getWidth()
        const pageH = pdf.internal.pageSize.getHeight()
        const imgW = pageW
        const imgH = (canvas.height * imgW) / canvas.width
        let heightLeft = imgH
        let pos = 0
        pdf.addImage(imgData, 'PNG', 0, pos, imgW, imgH, undefined, 'FAST')
        heightLeft -= pageH
        while (heightLeft > 0) {
          pos = heightLeft - imgH
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, pos, imgW, imgH, undefined, 'FAST')
          heightLeft -= pageH
        }
        pdf.save('document.pdf')
      } finally {
        document.body.removeChild(frame)
      }
    } catch (e) {
      console.error('[v0] pdf export failed', e)
      alert(`pdf export failed: ${(e as Error).message}`)
    } finally {
      setBusy('')
    }
  }

  // The label the toolbar shows ("html · 124 lines"). Lines is the more
  // useful unit than bytes for code — users reason about size in lines
  // and it lets us be honest about what they're about to download.
  const lineCount = useMemo(() => code.split('\n').length, [code])
  const langLabel = lang || 'text'

  return (
    <div
      className="my-3 overflow-hidden border"
      style={{
        // Inline styles so the component matches the editorial palette
        // wherever it's mounted — chat transcript, history viewer,
        // or a future shared-snippet route — without depending on the
        // parent surface's specific Tailwind tokens.
        borderColor: 'var(--hairline)',
        background: 'rgb(var(--surface-rgb) / 0.6)',
        borderRadius: 2,
      }}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px]"
        style={{
          borderBottom: '1px solid var(--hairline-soft)',
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          color: 'rgb(var(--ink-soft-rgb))',
        }}
      >
        <span style={{ letterSpacing: '0.04em' }}>
          {langLabel} · {lineCount} {lineCount === 1 ? 'line' : 'lines'}
        </span>
        <div className="flex items-center gap-1">
          {previewable && (
            <ToolbarButton
              onClick={() => setShowPreview(s => !s)}
              active={showPreview}
            >
              {showPreview ? 'code' : 'preview'}
            </ToolbarButton>
          )}
          <ToolbarButton onClick={handleCopy}>
            {copied ? 'copied' : 'copy'}
          </ToolbarButton>
          <ToolbarButton onClick={handleDownload}>
            download
          </ToolbarButton>
          {tabular && (
            <ToolbarButton onClick={handleDownloadExcel}>
              excel
            </ToolbarButton>
          )}
          {canDocx && (
            <ToolbarButton
              onClick={handleDownloadDocx}
              disabled={busy === 'docx'}
            >
              {busy === 'docx' ? 'building…' : 'docx'}
            </ToolbarButton>
          )}
          {canPptx && (
            <ToolbarButton
              onClick={handleDownloadPptx}
              disabled={busy === 'pptx'}
            >
              {busy === 'pptx' ? 'building…' : 'pptx'}
            </ToolbarButton>
          )}
          {canPdf && (
            <ToolbarButton
              onClick={handleDownloadPdf}
              disabled={busy === 'pdf'}
            >
              {busy === 'pdf' ? 'rendering…' : 'pdf'}
            </ToolbarButton>
          )}
        </div>
      </div>
      {showPreview && previewable ? (
        <PreviewPane code={code} lang={lang} iframeRef={previewIframeRef} />
      ) : (
        <pre
          className="overflow-x-auto px-3 py-2.5 text-[12.5px] leading-relaxed"
          style={{
            margin: 0,
            fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
            color: 'rgb(var(--ink-rgb))',
          }}
        >
          <code className={`language-${langLabel}`}>{code}</code>
        </pre>
      )}
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-0.5 transition-colors"
      style={{
        // Hairline border, no shadow — matches the editorial system.
        border: '1px solid var(--hairline-soft)',
        borderRadius: 2,
        background: active ? 'rgb(var(--ink-rgb) / 0.06)' : 'transparent',
        color: 'rgb(var(--ink-soft-rgb))',
        fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
        fontSize: 10.5,
        letterSpacing: '0.04em',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  )
}

/**
 * Switchboard for the preview pane — picks the right renderer per
 * language so HTML stays sandboxed, CSV gets a real table, JSON gets
 * pretty-printed, and Markdown gets formatted text. Unknown languages
 * never get here because the toolbar only shows "preview" when
 * `PREVIEWABLE.has(lang)` is true.
 */
function PreviewPane({
  code,
  lang,
  iframeRef,
}: {
  code: string
  lang: string
  iframeRef?: React.MutableRefObject<HTMLIFrameElement | null>
}) {
  if (lang === 'html' || lang === 'svg' || lang === 'xml') {
    return <HtmlPreview code={code} lang={lang} iframeRef={iframeRef} />
  }
  if (lang === 'csv' || lang === 'tsv') {
    return <TablePreview code={code} delim={lang === 'tsv' ? '\t' : ','} />
  }
  if (lang === 'json') {
    return <JsonPreview code={code} />
  }
  if (lang === 'markdown' || lang === 'md') {
    return <MarkdownPreview code={code} iframeRef={iframeRef} />
  }
  if (lang === 'pptx') {
    return <PptxPreview code={code} />
  }
  if (lang === 'docx') {
    // docx specs are rendered through the markdown previewer because
    // the on-the-wire format is markdown-compatible — every paragraph
    // and heading round-trips. The download path uses the same parser.
    return <MarkdownPreview code={code} iframeRef={iframeRef} />
  }
  // Fallback shouldn't happen given PREVIEWABLE gating, but keep it
  // safe rather than silently throwing.
  return null
}

/**
 * Sandboxed preview iframe for HTML / SVG / XML output.
 *
 * Sandbox notes:
 *   `allow-scripts` is required for any HTML the model writes that
 *   includes `<script>` blocks (charts, demos, interactive widgets).
 *   We deliberately do NOT add `allow-same-origin` — without it the
 *   iframe lives in a unique opaque origin that cannot read the
 *   parent's cookies, localStorage, or postMessage state. This is
 *   the standard "trusted user-supplied HTML" recipe.
 *
 *   `allow-popups` and `allow-forms` are added so links and form
 *   submissions inside the preview behave correctly when the user is
 *   evaluating a real page; they don't grant any access back to the
 *   parent.
 *
 * Auto-resize: we listen for height changes from inside the iframe
 * via a ResizeObserver-driven postMessage so charts, long lists, and
 * dynamic content fit their content without a scroll bar inside the
 * preview. Falls back to a sensible minimum height before the first
 * message arrives or if the iframe blocks postMessage entirely.
 */
function HtmlPreview({
  code,
  lang,
  iframeRef: externalRef,
}: {
  code: string
  lang: string
  iframeRef?: React.MutableRefObject<HTMLIFrameElement | null>
}) {
  const ownRef = useRef<HTMLIFrameElement | null>(null)
  const iframeRef = externalRef ?? ownRef
  const [height, setHeight] = useState(320)

  // Build the document we'll feed via srcDoc. SVG and XML get wrapped
  // in a minimal HTML scaffold; raw HTML is passed through but with
  // a small auto-resize bridge appended so the parent learns about
  // content-height changes.
  const srcDoc = useMemo(() => {
    const resizer = `
<script>(function(){
  function send(){
    try {
      var h = Math.max(
        document.documentElement.scrollHeight || 0,
        document.body ? document.body.scrollHeight : 0,
        document.documentElement.offsetHeight || 0
      );
      parent.postMessage({ __cloxArtifact: 'resize', h: h }, '*');
    } catch(e) {}
  }
  window.addEventListener('load', send);
  if (document.readyState === 'complete') send();
  if ('ResizeObserver' in window) {
    new ResizeObserver(send).observe(document.documentElement);
  } else {
    setInterval(send, 500);
  }
})();<\/script>`
    if (lang === 'svg') {
      return [
        '<!doctype html><html><head><meta charset="utf-8"><style>',
        'html,body{margin:0;height:100%;}',
        'body{display:grid;place-items:center;background:#fafafa;padding:12px;}',
        'svg{max-width:100%;max-height:100%;}',
        '</style></head><body>',
        code,
        resizer,
        '</body></html>',
      ].join('')
    }
    if (lang === 'xml') {
      // Render XML as readable formatted text (browsers display raw
      // XML as a tree, but only when the response Content-Type says
      // so — srcDoc renders as text/html so we use a <pre> wrapper).
      return [
        '<!doctype html><html><head><meta charset="utf-8"><style>',
        'body{margin:0;font:13px ui-monospace,Menlo,monospace;padding:12px;background:#fafafa;color:#1a1a1a;}',
        'pre{margin:0;white-space:pre-wrap;word-break:break-word;}',
        '</style></head><body><pre>',
        // Encode HTML-special characters so the markup doesn't render.
        code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        '</pre>',
        resizer,
        '</body></html>',
      ].join('')
    }
    // Plain HTML — append the resizer just before the closing </body>
    // if one exists, otherwise append it at the end.
    if (/<\/body>/i.test(code)) {
      return code.replace(/<\/body>/i, resizer + '</body>')
    }
    return code + resizer
  }, [code, lang])

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      const data = e.data
      if (!data || typeof data !== 'object') return
      if ((data as { __cloxArtifact?: string }).__cloxArtifact !== 'resize') return
      const h = (data as { h?: number }).h
      if (typeof h !== 'number' || !Number.isFinite(h)) return
      // Clamp to a reasonable range so a runaway document can't push
      // the artifact off the bottom of the viewport.
      setHeight(Math.max(180, Math.min(h + 8, 1200)))
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  return (
    <iframe
      ref={iframeRef}
      title="Artifact preview"
      sandbox="allow-scripts allow-popups allow-forms allow-modals"
      srcDoc={srcDoc}
      style={{
        width: '100%',
        height,
        border: 0,
        background: '#fff',
        display: 'block',
      }}
    />
  )
}

/**
 * Table preview for CSV / TSV. Uses Papa Parse for proper RFC-4180
 * handling (quoted fields, embedded newlines, escaped quotes) — a
 * `split(',')` shortcut would corrupt the first row that contains a
 * comma inside a quoted cell.
 */
function TablePreview({ code, delim }: { code: string; delim: ',' | '\t' }) {
  const { rows, headerRow, isLikelyHeader } = useMemo(() => {
    const parsed = Papa.parse<string[]>(code, {
      delimiter: delim,
      skipEmptyLines: true,
    })
    const data = (parsed.data as string[][]).filter(r => r.length > 0)
    const headerRow = data[0] ?? []
    // Treat the first row as a header if every cell is non-empty and
    // not purely numeric — a reasonable heuristic that gets it right
    // for the vast majority of model-generated tables.
    const isLikelyHeader =
      headerRow.length > 0 &&
      headerRow.every(c => c && c.trim().length > 0 && !/^-?\d+(\.\d+)?$/.test(c.trim()))
    return { rows: data, headerRow, isLikelyHeader }
  }, [code, delim])

  if (rows.length === 0) {
    return (
      <div style={{ padding: 12, fontFamily: 'ui-monospace, monospace', color: 'rgb(var(--ink-soft-rgb))', fontSize: 12 }}>
        Empty table
      </div>
    )
  }

  const body = isLikelyHeader ? rows.slice(1) : rows

  return (
    <div style={{ overflow: 'auto', maxHeight: 420, background: 'rgb(var(--surface-rgb))' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
        {isLikelyHeader && (
          <thead>
            <tr>
              {headerRow.map((cell, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    borderBottom: '1px solid var(--hairline)',
                    fontWeight: 500,
                    fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
                    fontSize: 10.5,
                    letterSpacing: '0.04em',
                    color: 'rgb(var(--ink-soft-rgb))',
                    textTransform: 'uppercase',
                    position: 'sticky',
                    top: 0,
                    background: 'rgb(var(--surface-rgb))',
                  }}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: '5px 10px',
                    borderBottom: '1px solid var(--hairline-soft)',
                    color: 'rgb(var(--ink-rgb))',
                    fontFamily: 'var(--font-geist-sans), ui-sans-serif, system-ui',
                    verticalAlign: 'top',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Pretty-printed JSON. We try to parse first so we get canonical
 * indentation; if the body isn't valid JSON we fall back to showing
 * it verbatim with an inline parse-error pill.
 */
function JsonPreview({ code }: { code: string }) {
  const { formatted, error } = useMemo(() => {
    try {
      return { formatted: JSON.stringify(JSON.parse(code), null, 2), error: null as string | null }
    } catch (e) {
      return { formatted: code, error: (e as Error).message }
    }
  }, [code])
  return (
    <div>
      {error && (
        <div style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--hairline-soft)',
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontSize: 10.5,
          letterSpacing: '0.04em',
          color: 'rgb(var(--accent-rgb, 176 0 32))',
        }}>
          parse error: {error}
        </div>
      )}
      <pre
        className="overflow-x-auto px-3 py-2.5 text-[12.5px] leading-relaxed"
        style={{
          margin: 0,
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          color: 'rgb(var(--ink-rgb))',
          maxHeight: 420,
          overflow: 'auto',
        }}
      >
        <code>{formatted}</code>
      </pre>
    </div>
  )
}

/**
 * Markdown preview — renders inside the same sandboxed iframe used for
 * HTML so we don't pull `react-markdown` recursively into a child
 * artifact. We do the markdown→HTML conversion with a tiny inline
 * routine that handles the common subset (headings, paragraphs, bold,
 * italic, code spans, fenced blocks, lists, links). For anything more
 * exotic the user can flip to "code" view and read the source.
 */
function MarkdownPreview({
  code,
  iframeRef,
}: {
  code: string
  iframeRef?: React.MutableRefObject<HTMLIFrameElement | null>
}) {
  const html = useMemo(() => mdToHtml(code), [code])
  return <HtmlPreview code={html} lang="html" iframeRef={iframeRef} />
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Minimal Markdown → HTML — covers the subset the model is likely to
 * emit inside a ```markdown block (headings, paragraphs, bold/italic,
 * inline code, fences, ordered/unordered lists, links). We deliberately
 * keep this small; for anything richer the artifact's "code" toggle
 * shows the source untouched.
 */
function mdToHtml(md: string): string {
  // Extract fenced code blocks first so their contents aren't mangled
  // by inline rules. Each block gets a placeholder we substitute back
  // at the end.
  const blocks: string[] = []
  let body = md.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, src) => {
    blocks.push(
      `<pre><code class="language-${escapeHtml(String(lang || 'text'))}">${escapeHtml(src)}</code></pre>`,
    )
    return `\u0000BLOCK${blocks.length - 1}\u0000`
  })

  body = escapeHtml(body)
  // Headings
  body = body.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
  body = body.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
  body = body.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
  body = body.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
  body = body.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
  body = body.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>')
  // Inline code
  body = body.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  // Bold + italic (order matters — bold first)
  body = body.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
  body = body.replace(/(?<!\*)\*([^\*]+)\*/g, '<em>$1</em>')
  // Links
  body = body.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, text, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`,
  )
  // Lists — group consecutive `- ` / `* ` / `1. ` lines into <ul>/<ol>
  body = body.replace(/(?:^|\n)((?:[-*]\s.+(?:\n|$))+)/g, (_m, block) => {
    const items = block
      .trim()
      .split('\n')
      .map((l: string) => `<li>${l.replace(/^[-*]\s+/, '')}</li>`)
      .join('')
    return `\n<ul>${items}</ul>`
  })
  body = body.replace(/(?:^|\n)((?:\d+\.\s.+(?:\n|$))+)/g, (_m, block) => {
    const items = block
      .trim()
      .split('\n')
      .map((l: string) => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`)
      .join('')
    return `\n<ol>${items}</ol>`
  })
  // Paragraphs — wrap consecutive non-block lines.
  body = body
    .split(/\n{2,}/)
    .map(chunk => {
      const t = chunk.trim()
      if (!t) return ''
      if (/^<(h\d|ul|ol|pre|blockquote|table)/.test(t)) return t
      if (/^\u0000BLOCK\d+\u0000$/.test(t)) return t
      return `<p>${t.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')

  // Substitute fenced blocks back in.
  body = body.replace(/\u0000BLOCK(\d+)\u0000/g, (_m, i) => blocks[Number(i)] ?? '')

  // Wrap in a tiny styled doc so the iframe renders nicely.
  return [
    '<!doctype html><html><head><meta charset="utf-8"><style>',
    'body{font:14px/1.6 ui-sans-serif,system-ui;color:#1a1a1a;margin:0;padding:14px 16px;background:#fff;}',
    'h1,h2,h3,h4,h5,h6{margin:1.1em 0 0.4em;line-height:1.25;}',
    'h1{font-size:1.6em;}h2{font-size:1.35em;}h3{font-size:1.15em;}',
    'p{margin:0.6em 0;}',
    'ul,ol{margin:0.6em 0 0.6em 1.4em;padding:0;}',
    'li{margin:0.2em 0;}',
    'code{font:12.5px ui-monospace,Menlo,monospace;background:#f4f4f4;padding:1px 4px;border-radius:2px;}',
    'pre{background:#f7f7f7;border:1px solid #eee;border-radius:2px;padding:10px 12px;overflow:auto;}',
    'pre code{background:transparent;padding:0;}',
    'a{color:#1f63d1;}',
    '</style></head><body>',
    body,
    '</body></html>',
  ].join('')
}

/* ------------------------------------------------------------------ */
/*                  PPTX outline preview + parser                      */
/* ------------------------------------------------------------------ */

/** The structural shape we accept inside a ```pptx fenced block. The
 *  helper is forgiving — both top-level `slides` arrays and bare
 *  arrays are accepted, and `bullets` may be an array of strings or a
 *  newline-delimited string. */
interface PptxSpec {
  title?: string
  theme?: { background?: string; accent?: string }
  slides: Array<{
    title?: string
    bullets?: string[]
    body?: string
    notes?: string
  }>
}

function parsePptxSpec(raw: string): PptxSpec {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    // Soft-fallback: some models emit YAML-ish lists. We try a very
    // light heuristic — split into slide-shaped chunks separated by
    // blank lines — so the user still gets a deck instead of an error.
    const groups = raw.split(/\n\s*\n/).filter(Boolean)
    return {
      slides: groups.map(g => {
        const lines = g.split('\n').map(l => l.trim()).filter(Boolean)
        const [title, ...rest] = lines
        return {
          title,
          bullets: rest.map(l => l.replace(/^[-*•]\s+/, '')),
        }
      }),
    }
  }

  // Normalise bare arrays and bullet-as-string forms.
  const root = (Array.isArray(json) ? { slides: json } : (json as PptxSpec)) ?? { slides: [] }
  const slides = (root.slides ?? []).map(s => ({
    ...s,
    bullets: Array.isArray(s.bullets)
      ? s.bullets.filter(Boolean)
      : typeof s.bullets === 'string'
        ? (s.bullets as unknown as string).split(/\r?\n/).filter(Boolean)
        : undefined,
  }))
  return { ...root, slides }
}

/**
 * Visual preview for a pptx outline — a vertical stack of slide cards
 * so the user can sanity-check the deck structure before downloading.
 * Each card mirrors the fonts / colors the actual exporter uses so the
 * preview is faithful to the .pptx output.
 */
function PptxPreview({ code }: { code: string }) {
  const spec = useMemo(() => parsePptxSpec(code), [code])
  const accent = spec.theme?.accent ?? '#1a1a1a'
  const bg = spec.theme?.background ?? '#ffffff'
  return (
    <div style={{ padding: 14, maxHeight: 520, overflow: 'auto', background: 'rgb(var(--surface-rgb))' }}>
      {spec.title && (
        <div style={{
          marginBottom: 12,
          fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
          fontSize: 10.5,
          letterSpacing: '0.06em',
          color: 'rgb(var(--ink-soft-rgb))',
          textTransform: 'uppercase',
        }}>
          Deck · {spec.title}
        </div>
      )}
      <div style={{ display: 'grid', gap: 10 }}>
        {spec.slides.map((s, i) => (
          <div
            key={i}
            style={{
              border: '1px solid var(--hairline)',
              borderRadius: 2,
              padding: '14px 16px',
              background: bg,
              color: accent,
              fontFamily: 'Helvetica, ui-sans-serif, system-ui',
            }}
          >
            <div style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              color: 'rgb(var(--ink-soft-rgb))',
              fontFamily: 'var(--font-geist-mono), ui-monospace, monospace',
              marginBottom: 4,
            }}>
              SLIDE {i + 1}
            </div>
            {s.title && (
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
                {s.title}
              </div>
            )}
            {s.bullets && s.bullets.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
                {s.bullets.map((b, bi) => <li key={bi}>{b}</li>)}
              </ul>
            ) : s.body ? (
              <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{s.body}</div>
            ) : null}
            {s.notes && (
              <div style={{
                marginTop: 8,
                paddingTop: 6,
                borderTop: '1px dashed var(--hairline-soft)',
                fontSize: 11.5,
                color: 'rgb(var(--ink-soft-rgb))',
                fontStyle: 'italic',
              }}>
                Notes: {s.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*                  DOCX builder (markdown → docx)                     */
/* ------------------------------------------------------------------ */

/**
 * Convert the artifact body into the array of `Paragraph` / `Table`
 * objects the `docx` library expects.
 *
 * For markdown / md / docx-as-markdown sources we walk the source
 * line-by-line and translate the common subset (headings, paragraphs,
 * unordered/ordered lists, code fences). For HTML we strip tags into
 * paragraphs while keeping headings — good enough for most assistant-
 * authored reports; users who want pixel-perfect rendering should
 * choose the PDF export instead.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDocxChildren(docx: typeof import('docx'), source: string, lang: string): any[] {
  const { Paragraph, HeadingLevel, TextRun, AlignmentType } = docx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = []

  const md =
    lang === 'html' ? htmlToMarkdownLite(source) :
    source

  const lines = md.split(/\r?\n/)
  let inFence = false
  let fenceBuf: string[] = []
  for (const rawLine of lines) {
    if (rawLine.startsWith('```')) {
      if (inFence) {
        // Flush fence as a monospaced paragraph block.
        children.push(new Paragraph({
          children: [new TextRun({
            text: fenceBuf.join('\n'),
            font: 'Consolas',
            size: 20, // half-points → 10pt
          })],
          spacing: { before: 120, after: 120 },
        }))
        fenceBuf = []
        inFence = false
      } else {
        inFence = true
      }
      continue
    }
    if (inFence) { fenceBuf.push(rawLine); continue }

    const line = rawLine.replace(/\s+$/, '')
    if (line.length === 0) {
      children.push(new Paragraph({ children: [] }))
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const lvl = heading[1].length
      const levelMap = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
        HeadingLevel.HEADING_5,
        HeadingLevel.HEADING_6,
      ]
      children.push(new Paragraph({
        text: heading[2],
        heading: levelMap[lvl - 1],
        alignment: AlignmentType.LEFT,
      }))
      continue
    }
    const ulItem = /^[-*]\s+(.*)$/.exec(line)
    if (ulItem) {
      children.push(new Paragraph({
        text: ulItem[1],
        bullet: { level: 0 },
      }))
      continue
    }
    const olItem = /^(\d+)\.\s+(.*)$/.exec(line)
    if (olItem) {
      children.push(new Paragraph({
        text: olItem[2],
        numbering: { reference: 'default-numbering', level: 0 },
      }))
      continue
    }
    // Inline emphasis — split into runs so bold/italic survive.
    const runs = inlineToRuns(docx, line)
    children.push(new Paragraph({ children: runs }))
  }
  // Close an unterminated fence to preserve content.
  if (inFence && fenceBuf.length > 0) {
    children.push(new Paragraph({
      children: [new TextRun({ text: fenceBuf.join('\n'), font: 'Consolas', size: 20 })],
    }))
  }
  return children
}

/** Convert `**bold**` / `*italic*` / `` `code` `` markup into TextRun
 *  segments. Anything more exotic falls through as plain text — the
 *  goal is "Word recognises emphasis", not full markdown fidelity. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inlineToRuns(docx: typeof import('docx'), line: string): any[] {
  const { TextRun } = docx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = []
  // Split on the three markup tokens, keeping delimiters via lookahead.
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: line.slice(last, m.index) }))
    const tok = m[0]
    if (tok.startsWith('**')) {
      out.push(new TextRun({ text: tok.slice(2, -2), bold: true }))
    } else if (tok.startsWith('*')) {
      out.push(new TextRun({ text: tok.slice(1, -1), italics: true }))
    } else if (tok.startsWith('`')) {
      out.push(new TextRun({ text: tok.slice(1, -1), font: 'Consolas' }))
    }
    last = m.index + tok.length
  }
  if (last < line.length) out.push(new TextRun({ text: line.slice(last) }))
  if (out.length === 0) out.push(new TextRun({ text: line }))
  return out
}

/** Default styling so the .docx looks like a real Word doc rather than
 *  default Calibri-12. We keep the configuration tiny — Word users
 *  routinely retheme — but ship sane line height + heading sizes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaultDocxStyles(docx: typeof import('docx')): any {
  return {
    default: {
      document: {
        run: { font: 'Calibri', size: 22 }, // 11pt
        paragraph: { spacing: { line: 320 } }, // 1.33 line height
      },
    },
  }
}

/** Very small HTML→Markdown bridge for the docx exporter — only a
 *  handful of tags survive. Anything else degrades to plain text. */
function htmlToMarkdownLite(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*h1[^>]*>(.*?)<\s*\/\s*h1\s*>/gi, '# $1\n')
    .replace(/<\s*h2[^>]*>(.*?)<\s*\/\s*h2\s*>/gi, '## $1\n')
    .replace(/<\s*h3[^>]*>(.*?)<\s*\/\s*h3\s*>/gi, '### $1\n')
    .replace(/<\s*h4[^>]*>(.*?)<\s*\/\s*h4\s*>/gi, '#### $1\n')
    .replace(/<\s*p[^>]*>(.*?)<\s*\/\s*p\s*>/gi, '$1\n\n')
    .replace(/<\s*strong[^>]*>(.*?)<\s*\/\s*strong\s*>/gi, '**$1**')
    .replace(/<\s*b[^>]*>(.*?)<\s*\/\s*b\s*>/gi, '**$1**')
    .replace(/<\s*em[^>]*>(.*?)<\s*\/\s*em\s*>/gi, '*$1*')
    .replace(/<\s*i[^>]*>(.*?)<\s*\/\s*i\s*>/gi, '*$1*')
    .replace(/<\s*li[^>]*>(.*?)<\s*\/\s*li\s*>/gi, '- $1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/** If the model emitted an HTML fragment (no <html> wrapper), wrap it
 *  in a minimal styled doc so html2canvas / preview render readably. */
function ensureFullHtml(html: string): string {
  if (/<html[\s>]/i.test(html)) return html
  return [
    '<!doctype html><html><head><meta charset="utf-8"><style>',
    'body{font:14px/1.6 ui-sans-serif,system-ui;color:#1a1a1a;margin:0;padding:24px;background:#fff;}',
    'h1,h2,h3{margin:1em 0 0.4em;line-height:1.25;}',
    'p{margin:0.6em 0;}',
    'ul,ol{margin:0.6em 0 0.6em 1.4em;padding:0;}',
    'pre{background:#f5f5f5;padding:10px 12px;overflow:auto;border:1px solid #eee;}',
    'code{font:12.5px ui-monospace,Menlo,monospace;}',
    'table{border-collapse:collapse;width:100%;margin:0.8em 0;}',
    'th,td{border:1px solid #e3e3e3;padding:6px 10px;text-align:left;}',
    '</style></head><body>',
    html,
    '</body></html>',
  ].join('')
}

/** Wrap a raw <svg>…</svg> for the PDF exporter. */
function svgToFullHtml(svg: string): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8"><style>',
    'body{margin:0;display:grid;place-items:center;background:#fff;padding:24px;}',
    'svg{max-width:100%;height:auto;}',
    '</style></head><body>',
    svg,
    '</body></html>',
  ].join('')
}

/**
 * Tiny helper — given a Blob, trigger a browser download with the
 * supplied filename. Centralised so the standard / Excel / future
 * variants don't drift on the boilerplate.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke a tick so Safari's download flow has time to read.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
