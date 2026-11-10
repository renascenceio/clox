'use client'

export type SandboxLine = { text: string; state: 'pending' | 'done' | 'failed' }

const CSS = `@keyframes cloxPulse{0%,100%{opacity:1}50%{opacity:.25}}`

/**
 * One quiet line for what the sandbox is doing ("Starting Python
 * sandbox…" → "Sandbox ready · 1s"). It shows only the latest step, and
 * once the reply is finished it goes away unless something failed.
 */
export function SandboxStatus({ lines, live }: { lines: SandboxLine[]; live: boolean }) {
  const failures = lines.filter(l => l.state === 'failed')
  const shown = failures.length > 0 ? failures : live ? lines.slice(-1) : []
  if (shown.length === 0) return null
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <style>{CSS}</style>
      {shown.map((l, i) => (
        <StatusLine key={i} text={l.text} state={l.state} />
      ))}
    </div>
  )
}

export function StatusLine({ text, state }: SandboxLine) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, lineHeight: 1.4,
        color: state === 'failed' ? 'var(--accent, #b00020)' : 'inherit',
        opacity: state === 'failed' ? 1 : 0.6,
      }}
    >
      <span aria-hidden style={{ width: 12, display: 'inline-flex', justifyContent: 'center', flexShrink: 0 }}>
        {state === 'pending' ? (
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', animation: 'cloxPulse 1.4s ease-in-out infinite' }} />
        ) : state === 'failed' ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l6 6M9 3l-6 6" /></svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5l2.3 2.3L9.5 3.5" /></svg>
        )}
      </span>
      <span>{text}</span>
    </div>
  )
}
