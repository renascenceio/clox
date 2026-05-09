'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Standalone artifact preview surface. The chat composer's "open"
 * button parks the rendered HTML / SVG / Markdown in `sessionStorage`
 * under a uuid and navigates here with `?id=<uuid>&kind=html&title=…`.
 *
 * Why a real route instead of just `URL.createObjectURL(blob)`:
 *   - The URL bar shows `/preview?id=…&kind=html` rather than an opaque
 *     `blob:https://…/uuid`. That's the user feedback we got — they
 *     couldn't tell from the address bar that they were looking at HTML.
 *   - sessionStorage survives the click-to-open even when popup blockers
 *     interfere with `window.open(blob)`. The new tab just reads its
 *     payload back out by id and renders it inline.
 *   - Same-origin means the inner iframe inherits the parent's referrer
 *     policy and isn't subject to the third-party tracking heuristics
 *     that some browsers apply to opaque blob: contexts.
 *
 * Storage shape:
 *   sessionStorage[`clox.preview.${id}`] = JSON.stringify({
 *     kind: 'html' | 'svg' | 'markdown',
 *     title: string,
 *     html: string,         // already-scaffolded full HTML document
 *   })
 *
 * The payload is removed from sessionStorage after a successful render
 * so we don't leak old previews into future sessions.
 */
export default function PreviewPage() {
  return (
    <Suspense fallback={<PreviewShell title="Loading preview…" body={null} />}>
      <PreviewBody />
    </Suspense>
  )
}

function PreviewBody() {
  const params = useSearchParams()
  const id = params.get('id') ?? ''
  const kind = params.get('kind') ?? 'html'
  const titleParam = params.get('title') ?? 'Artifact preview'

  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; html: string; title: string }
    | { status: 'missing' }
  >({ status: 'loading' })

  useEffect(() => {
    if (!id) {
      setState({ status: 'missing' })
      return
    }
    try {
      const key = `clox.preview.${id}`
      const raw = sessionStorage.getItem(key)
      if (!raw) {
        setState({ status: 'missing' })
        return
      }
      const parsed = JSON.parse(raw) as { html?: string; title?: string }
      if (!parsed.html) {
        setState({ status: 'missing' })
        return
      }
      // Update the document title so browser history / bookmarks /
      // tab-overflow menus show something meaningful — `Clox · <title>`
      // makes it clear which artifact this tab is hosting.
      const safeTitle = (parsed.title ?? titleParam).slice(0, 120)
      document.title = `Clox · ${safeTitle}`
      setState({ status: 'ready', html: parsed.html, title: safeTitle })
      // Tidy up — single-shot read, no stale payloads.
      try { sessionStorage.removeItem(key) } catch {}
    } catch (e) {
      console.error('[v0] preview read failed', e)
      setState({ status: 'missing' })
    }
  }, [id, titleParam])

  if (state.status === 'loading') {
    return <PreviewShell title="Loading preview…" body={null} />
  }
  if (state.status === 'missing') {
    return (
      <PreviewShell
        title="Preview not found"
        body={
          <div style={emptyStateStyle}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>
              This preview link has expired
            </div>
            <p style={{ margin: '0 0 12px 0', fontSize: 13.5, color: '#666' }}>
              Artifact previews are stored in your browser&apos;s session
              storage and are read once when this tab opens. To re-open
              the preview, return to the chat and click <strong>open</strong>
              on the artifact toolbar again.
            </p>
            <button
              type="button"
              onClick={() => window.close()}
              style={{
                font: 'inherit',
                padding: '6px 14px',
                border: '1px solid #d4d4d4',
                background: '#fafafa',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Close tab
            </button>
          </div>
        }
      />
    )
  }
  return (
    <PreviewShell
      title={state.title}
      body={
        <iframe
          title={state.title}
          // Sandbox is intentionally permissive enough to render rich
          // HTML demos (scripts, popups, forms) but excludes
          // `allow-same-origin` so the artifact never gets access to
          // the parent route's cookies / localStorage / IndexedDB.
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms allow-modals allow-downloads"
          referrerPolicy="no-referrer"
          srcDoc={state.html}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            background: '#ffffff',
            display: 'block',
            colorScheme: 'light',
          }}
        />
      }
      kind={kind}
    />
  )
}

const emptyStateStyle: React.CSSProperties = {
  maxWidth: 460,
  margin: '80px auto',
  padding: '24px 28px',
  fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  textAlign: 'center',
  color: '#1a1a1a',
}

function PreviewShell({
  title,
  body,
  kind,
}: {
  title: string
  body: React.ReactNode
  kind?: string
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        colorScheme: 'light',
      }}
    >
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '8px 14px',
          borderBottom: '1px solid #e8e8e8',
          background: '#fafafa',
          fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
          fontSize: 12,
          color: '#666',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              padding: '1px 6px',
              border: '1px solid #d4d4d4',
              borderRadius: 2,
              fontSize: 10.5,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: '#fff',
              color: '#1a1a1a',
            }}
          >
            {kind ?? 'html'} preview
          </span>
          <span
            style={{
              fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: 13,
              color: '#1a1a1a',
              fontWeight: 500,
            }}
          >
            {title}
          </span>
        </span>
        <span style={{ fontSize: 11, opacity: 0.7 }}>clox.app</span>
      </div>
      <div style={{ flex: '1 1 auto', minHeight: 0, position: 'relative' }}>
        {body}
      </div>
    </div>
  )
}
