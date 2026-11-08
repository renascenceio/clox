'use client'

import { useState } from 'react'

/**
 * The steps the assistant took (code runs, searches, skill loads) as one
 * compact list: a line per step, long code never spills across the chat.
 * While the reply is being written the list stays open; afterwards it
 * folds into a one-line summary the reader can open again.
 */

export type WorkStep = {
  toolCallId?: string
  toolName?: string
  state?: 'partial-call' | 'call' | 'result'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result?: any
}

const MONO = `'Geist Mono', ui-monospace, SFMono-Regular, monospace`
// Letters or digits in Latin, Cyrillic, Arabic or CJK — a line without any is decoration.
const WORDISH = /[A-Za-z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u3040-\u9FFF]/

/** First meaningful line of a script: comment markers and ruled lines
 *  ("# ──── SLIDE 2 ────") are dropped so only the words remain. */
export function firstLine(text: unknown): string | null {
  for (const raw of String(text ?? '').split('\n')) {
    let line = raw.trim()
    if (!line) continue
    line = line
      .replace(/^(#+|\/\/+|--|;+|\/\*+|\*+)\s*/, '')
      .replace(/\*\/\s*$/, '')
      .replace(/[\u2500-\u259F]+|[=~_*#\-]{3,}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!line || !WORDISH.test(line)) continue
    return line.length > 160 ? `${line.slice(0, 157)}…` : line
  }
  return null
}

type Described = { label: string; detail: string | null; outcome: string | null; failed: boolean }

function describe(step: WorkStep, skillName: (id: string) => string | undefined): Described {
  const name = String(step.toolName ?? 'tool')
  const running = step.state !== 'result'
  const r = step.result
  let label: string
  let detail: string | null = null
  let outcome: string | null = null
  let failed = false

  if (name === 'web_search') {
    label = running ? 'Searching' : 'Searched'
    detail = step.args?.query ? `“${String(step.args.query)}”` : null
    if (!running) {
      if (r?.error) { failed = true; outcome = firstLine(r.error) }
      else if (Array.isArray(r?.results)) outcome = `${r.results.length} result${r.results.length === 1 ? '' : 's'}`
    }
  } else if (name === 'python' || name === 'bash' || name === 'run_javascript') {
    const verb = name === 'bash' ? 'shell' : name === 'python' ? 'Python' : 'JavaScript'
    label = running ? `Running ${verb}` : verb
    detail = firstLine(name === 'bash' ? step.args?.command : step.args?.code)
    if (!running && r) {
      if (r.ok === false) {
        failed = true
        outcome = firstLine(r.stderr) ?? firstLine(r.error) ?? `exit ${r.exitCode ?? '?'}`
      } else if (name === 'run_javascript') {
        outcome = r.result !== undefined ? firstLine(r.result) : null
      } else {
        const lines = String(r.stdout ?? '').split('\n').map(l => l.trim()).filter(Boolean)
        // The kit prints progress first and the useful line ("✓ slide 4/12 …") last.
        outcome = firstLine(lines[lines.length - 1] ?? '')
      }
    }
  } else if (name === 'read_skill') {
    const id = String(step.args?.skill_id ?? '')
    label = running ? 'Loading skill' : 'Skill'
    detail = skillName(id) ?? (id || null)
  } else {
    label = running ? `Calling ${name}` : name
  }
  return { label, detail, outcome, failed }
}

function Glyph({ state }: { state: 'running' | 'done' | 'failed' }) {
  if (state === 'running') {
    return (
      <span
        aria-hidden
        style={{
          width: 6, height: 6, borderRadius: 999, background: 'currentColor',
          animation: 'cloxPulse 1.2s ease-in-out infinite', flex: '0 0 auto', marginTop: 6,
        }}
      />
    )
  }
  return (
    <span
      aria-hidden
      style={{
        width: 12, flex: '0 0 12px', fontSize: 11, lineHeight: '18px', textAlign: 'center',
        color: state === 'failed' ? 'var(--accent, #b00020)' : 'inherit', opacity: state === 'failed' ? 1 : 0.5,
      }}
    >
      {state === 'failed' ? '✕' : '✓'}
    </span>
  )
}

export function WorkLog({
  steps,
  live,
  skillName,
}: {
  steps: WorkStep[]
  live: boolean
  skillName: (id: string) => string | undefined
}) {
  const [open, setOpen] = useState<boolean | null>(null)
  if (steps.length === 0) return null
  const rows = steps.map(s => ({ step: s, ...describe(s, skillName), running: s.state !== 'result' }))
  const failures = rows.filter(r => r.failed).length
  const runningRow = rows.find(r => r.running)
  const expanded = open ?? live
  const summary = runningRow
    ? `${runningRow.label}${runningRow.detail ? ` · ${runningRow.detail}` : ''}`
    : `${rows.length} step${rows.length === 1 ? '' : 's'}${failures ? ` · ${failures} failed` : ''}`

  return (
    <div
      style={{
        borderLeft: '1px solid var(--hairline, rgba(127,127,127,.3))',
        paddingLeft: 12,
        minWidth: 0,
        fontSize: 12.5,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0,
          padding: '2px 0', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer',
          fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'left',
        }}
      >
        <span
          aria-hidden
          style={{ display: 'inline-block', transition: 'transform .15s', transform: expanded ? 'rotate(90deg)' : 'none', opacity: 0.6 }}
        >
          ›
        </span>
        <span style={{ opacity: 0.6, flex: '0 0 auto' }}>{live || runningRow ? 'Working' : 'Worked'}</span>
        <span
          style={{
            opacity: 0.85, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textTransform: runningRow ? 'none' : 'uppercase', letterSpacing: runningRow ? 0 : '0.1em',
            fontSize: runningRow ? 11.5 : 10.5,
          }}
        >
          {summary}
        </span>
      </button>
      {expanded && (
        <ol style={{ listStyle: 'none', margin: '4px 0 0', padding: 0, display: 'flex', flexDirection: 'column' }}>
          {rows.map((r, i) => (
            <li
              key={r.step.toolCallId ?? i}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, padding: '3px 0', lineHeight: '18px' }}
            >
              <Glyph state={r.running ? 'running' : r.failed ? 'failed' : 'done'} />
              <span
                style={{
                  flex: '0 0 auto', fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.08em',
                  textTransform: 'uppercase', opacity: 0.55, minWidth: 64,
                }}
              >
                {r.label}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                {r.detail && (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.9 }}>
                    {r.detail}
                  </span>
                )}
                {r.outcome && (
                  <span
                    style={{
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 11,
                      opacity: r.failed ? 0.95 : 0.55, color: r.failed ? 'var(--accent, #b00020)' : undefined,
                    }}
                  >
                    {r.outcome}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
