/**
 * BrowserPanel — shows what the model's browser is doing, live.
 *
 * One panel per assistant turn: a window with the current address and
 * the latest screenshot, and a step list underneath. Clicking a step
 * shows the page as it was after that step. While an action runs the
 * screenshot dims and the running step pulses, so the user can follow
 * along the way they would watch someone else drive.
 */
'use client'

import React, { useState } from 'react'
import { stableFileUrl } from '@/lib/storage/file-url'

export interface BrowserInvocation {
  toolCallId?: string
  state?: string
  args?: Record<string, unknown>
  result?: {
    ok?: boolean
    url?: string
    title?: string
    message?: string
    shot?: string | null
  }
}

export interface BrowserProgressEvent {
  phase: string
  durationMs?: number
  error?: string
}

function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

function describe(inv: BrowserInvocation): string {
  const a = inv.args ?? {}
  const ref = a.ref ? String(a.ref).replace(/^@/, '') : ''
  switch (a.action) {
    case 'open': return `Open ${host(String(a.url ?? ''))}`
    case 'click': return `Click ${ref}`
    case 'type': return `Type “${String(a.text ?? '').slice(0, 40)}”${a.submit ? ' and submit' : ''}`
    case 'press': return `Press ${String(a.key ?? '')}`
    case 'select': return `Choose “${String(a.value ?? '')}”`
    case 'scroll': return `Scroll ${String(a.direction ?? 'down')}`
    case 'back': return 'Back'
    case 'read': return 'Read the page'
    case 'look': return 'Look at the page'
    default: return String(a.action ?? 'Step')
  }
}

function bootLine(events: BrowserProgressEvent[]): string | null {
  const last = events[events.length - 1]
  if (!last) return null
  if (last.phase === 'browser-booting') return 'Starting the browser…'
  if (last.phase === 'browser-installing') return 'Installing Chrome (first use, about a minute)…'
  if (last.phase === 'browser-failed') return `Browser failed to start: ${last.error ?? 'unknown error'}`
  return null
}

export function BrowserPanel({
  invocations,
  progress = [],
  live = false,
}: {
  invocations: BrowserInvocation[]
  progress?: BrowserProgressEvent[]
  live?: boolean
}) {
  const [picked, setPicked] = useState<number | null>(null)
  if (invocations.length === 0) return null

  const running = invocations.findIndex(i => i.state !== 'result')
  const withShot = invocations
    .map((inv, i) => ({ inv, i }))
    .filter(({ inv }) => inv.state === 'result' && inv.result?.shot)
  const latest = withShot[withShot.length - 1]
  const shown = picked !== null ? withShot.find(s => s.i === picked) ?? latest : latest
  const page = shown?.inv.result
  const busy = live && running !== -1
  const boot = busy ? bootLine(progress) : null
  const address = page?.url || String(invocations[0]?.args?.url ?? '')

  return (
    <figure
      aria-label="Browser"
      style={{ margin: 0, border: '1px solid currentColor', borderRadius: 3, overflow: 'hidden', fontSize: 12 }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          borderBottom: '1px solid currentColor',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11,
        }}
      >
        <span style={{ letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 10, flexShrink: 0 }}>Browser</span>
        {busy && (
          <span aria-hidden style={{
            width: 6, height: 6, borderRadius: 999, background: 'currentColor', flexShrink: 0,
            animation: 'cloxPulse 1.4s ease-in-out infinite',
          }} />
        )}
        <span
          title={address}
          style={{
            flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            padding: '2px 8px', border: '1px solid currentColor', borderRadius: 999, opacity: 0.85,
          }}
        >
          {address || 'about:blank'}
        </span>
        {page?.url && (
          <a href={page.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', flexShrink: 0 }}>
            Open page
          </a>
        )}
      </div>

      <div style={{ position: 'relative', aspectRatio: '1280 / 800', background: 'rgba(127,127,127,0.12)' }}>
        {page?.shot ? (
          <a href={stableFileUrl(page.shot)} target="_blank" rel="noreferrer" title="Open full-size screenshot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stableFileUrl(page.shot)}
              alt={page.title ? `Screenshot of ${page.title}` : 'Browser screenshot'}
              style={{
                display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top',
                opacity: busy && picked === null ? 0.55 : 1, transition: 'opacity 200ms',
              }}
            />
          </a>
        ) : null}
        {(busy || !page?.shot) && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute', left: 10, bottom: 10, padding: '4px 10px', borderRadius: 999,
              background: 'rgba(0,0,0,0.72)', color: '#fff',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 11,
            }}
          >
            {boot ?? (running !== -1 ? `${describe(invocations[running])}…` : 'No screenshot')}
          </div>
        )}
        <style>{`@keyframes cloxPulse { 0%,100%{opacity:1} 50%{opacity:.25} }`}</style>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: '6px 6px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {invocations.map((inv, i) => {
          const done = inv.state === 'result'
          const failed = done && inv.result?.ok === false
          const active = shown?.i === i
          return (
            <li key={inv.toolCallId ?? i}>
              <button
                type="button"
                disabled={!done || !inv.result?.shot}
                onClick={() => setPicked(i === latest?.i ? null : i)}
                title={failed ? inv.result?.message : inv.result?.title}
                style={{
                  font: 'inherit', fontSize: 11, color: 'inherit', cursor: done && inv.result?.shot ? 'pointer' : 'default',
                  padding: '3px 8px', borderRadius: 999,
                  border: `1px solid ${active ? 'currentColor' : 'rgba(127,127,127,0.35)'}`,
                  background: active ? 'rgba(127,127,127,0.15)' : 'transparent',
                  opacity: done ? 1 : 0.7,
                  textDecoration: failed ? 'line-through' : undefined,
                }}
              >
                <span style={{ opacity: 0.55, marginRight: 6 }}>{i + 1}</span>
                {describe(inv)}
                {!done && <span aria-hidden style={{ marginLeft: 6, animation: 'cloxPulse 1.4s ease-in-out infinite' }}>●</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
