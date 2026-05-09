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
}

/** Languages we know how to render in the inline preview pane. */
const PREVIEWABLE = new Set([
  'html', 'svg', 'xml',
  'csv', 'tsv',
  'json',
  'md', 'markdown',
])

/** Languages that should also offer an "Excel" download option. */
const TABULAR = new Set(['csv', 'tsv'])

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
    lang === 'html' || lang === 'svg' || lang === 'markdown' || lang === 'md',
  )
  const previewable = PREVIEWABLE.has(lang)
  const tabular = TABULAR.has(lang)

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
        </div>
      </div>
      {showPreview && previewable ? (
        <PreviewPane code={code} lang={lang} />
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
  children,
}: {
  onClick: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
        cursor: 'pointer',
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
function PreviewPane({ code, lang }: { code: string; lang: string }) {
  if (lang === 'html' || lang === 'svg' || lang === 'xml') {
    return <HtmlPreview code={code} lang={lang} />
  }
  if (lang === 'csv' || lang === 'tsv') {
    return <TablePreview code={code} delim={lang === 'tsv' ? '\t' : ','} />
  }
  if (lang === 'json') {
    return <JsonPreview code={code} />
  }
  if (lang === 'markdown' || lang === 'md') {
    return <MarkdownPreview code={code} />
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
function HtmlPreview({ code, lang }: { code: string; lang: string }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
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
function MarkdownPreview({ code }: { code: string }) {
  const html = useMemo(() => mdToHtml(code), [code])
  return <HtmlPreview code={html} lang="html" />
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
