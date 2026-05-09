'use client'

/**
 * Renders a fenced code block as a downloadable artifact.
 *
 * The chat surface used to render assistant code as plain styled text
 * inside ReactMarkdown — readable, but you couldn't actually do
 * anything with it. Here we wrap each block with a small toolbar that
 * lets the user:
 *
 *   • Copy   — clipboard write
 *   • Download — saves the body as a real file with a sane extension
 *                inferred from the language tag
 *   • Preview  — for HTML/SVG, opens a sandboxed iframe inline so the
 *                user can see what they actually got back
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

import { useMemo, useState } from 'react'
import type { ComponentProps } from 'react'

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

/** Languages we can safely render in a sandboxed preview iframe. */
const PREVIEWABLE = new Set(['html', 'svg', 'xml'])

/** Pull the language hint off the className react-markdown emits. */
function readLang(className?: string): string {
  if (!className) return ''
  const m = /language-([\w-]+)/.exec(className)
  return m ? m[1].toLowerCase() : ''
}

function inferFilename(lang: string): string {
  const ext = LANG_EXT[lang] || 'txt'
  return `snippet.${ext}`
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
  const [showPreview, setShowPreview] = useState(false)
  const previewable = PREVIEWABLE.has(lang)

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
    const mime = lang === 'json' ? 'application/json'
      : lang === 'csv' ? 'text/csv'
      : lang === 'html' ? 'text/html'
      : lang === 'svg' ? 'image/svg+xml'
      : 'text/plain'
    const blob = new Blob([code], { type: `${mime};charset=utf-8` })
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
        </div>
      </div>
      {showPreview && previewable ? (
        <PreviewFrame code={code} lang={lang} />
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
 * Sandboxed preview iframe for HTML / SVG output. The sandbox attribute
 * is intentionally restrictive (`allow-scripts` only — no `allow-same-origin`)
 * so a malicious snippet from the model cannot read the parent
 * application's cookies or storage. We use `srcDoc` rather than a Blob
 * URL because Blob URLs in iframes inherit the parent origin in some
 * browsers, defeating the sandbox.
 */
function PreviewFrame({ code, lang }: { code: string; lang: string }) {
  const srcDoc = useMemo(() => {
    if (lang === 'svg') {
      // Wrap raw SVG in a minimal HTML doc so it centres nicely and the
      // user can see the actual rendered output rather than the markup.
      return [
        '<!doctype html><html><head><style>',
        'html,body{margin:0;height:100%;}',
        'body{display:grid;place-items:center;background:#fafafa;}',
        'svg{max-width:100%;max-height:100%;}',
        '</style></head><body>',
        code,
        '</body></html>',
      ].join('')
    }
    return code
  }, [code, lang])

  return (
    <iframe
      title="Artifact preview"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{
        width: '100%',
        minHeight: 240,
        border: 0,
        background: '#fff',
        display: 'block',
      }}
    />
  )
}
