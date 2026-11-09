'use client'

import type { CSSProperties } from 'react'
import type { Palette } from './palettes'

/** Placeholder of a page while it loads: a title bar and a few rows of
 *  content shapes, softly pulsing. Drawn over the old page the moment a
 *  link is clicked. */
export function PageGhost({ p }: { p: Palette }) {
  const bar = (w: string | number, h: number, extra?: CSSProperties) => (
    <span
      aria-hidden
      style={{
        display: 'block',
        width: w,
        height: h,
        borderRadius: 3,
        background: p.surfaceAlt,
        animation: 'cloxGhost 1.3s ease-in-out infinite',
        ...extra,
      }}
    />
  )
  return (
    <div
      role="status"
      aria-label="Loading page"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        background: p.bg,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 52,
          flex: '0 0 52px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 24px',
          borderBottom: `1px solid ${p.hairlineSoft}`,
        }}
      >
        {bar(120, 10)}
        {bar(180, 14)}
      </div>
      <div style={{ padding: '40px 48px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1080 }}>
        {bar('38%', 28)}
        {bar('62%', 12, { opacity: 0.8 })}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginTop: 18 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              style={{
                height: 148,
                borderRadius: 4,
                border: `1px solid ${p.hairlineSoft}`,
                background: p.surface,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              {bar('70%', 12, { animationDelay: `${i * 90}ms` })}
              {bar('45%', 10, { animationDelay: `${i * 90}ms`, opacity: 0.7 })}
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}
