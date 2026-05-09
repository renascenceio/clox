'use client'

/**
 * RowActionsMenu — a small "three-dots" popover used on chat rows in the
 * sidebar, gallery tiles, and project cards. The menu is intentionally
 * action-agnostic: callers pass a list of items, each with an icon, label,
 * optional tone (`destructive` paints it red), and an `onSelect` handler.
 *
 * Behaviour:
 *   • Click on the trigger toggles the popover.
 *   • Outside-clicks close it (mousedown on document).
 *   • Escape closes it.
 *   • Each item closes the popover after firing its handler.
 *
 * Visual: hairline-only, fits inside the editorial Anthology palette.
 *   Pure CSS — no portals, no animation libs. The popover is positioned
 *   absolutely against the trigger, so the parent must be `position:relative`.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export interface RowActionItem {
  /** Required for keying. */
  key: string
  label: string
  icon?: ReactNode
  /** Tone — `destructive` styles the row in the danger color. */
  tone?: 'default' | 'destructive'
  onSelect: () => void
  /** Optional disabled flag (e.g. while a network operation is in flight). */
  disabled?: boolean
}

export interface RowActionsMenuProps {
  items: RowActionItem[]
  /** Tooltip on the trigger. */
  title?: string
  /** Where to anchor the popover. Defaults to `bottom-right`. */
  side?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  /** Optional className passthrough on the trigger button. */
  className?: string
  /** Only show the trigger when an ancestor with this attribute is hovered.
   *  When unset, the trigger is always visible. */
  showOnHoverOf?: string
}

export default function RowActionsMenu({
  items,
  title = 'More actions',
  side = 'bottom-right',
  className = '',
  showOnHoverOf,
}: RowActionsMenuProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  // Outside-click + escape ----------------------------------------------
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Anchor positioning. We use plain Tailwind classes so the consumer can
  // override via `className` if a special placement is needed.
  const popoverPosition =
    side === 'bottom-right' ? 'top-full right-0 mt-1'
    : side === 'bottom-left' ? 'top-full left-0 mt-1'
    : side === 'top-right'   ? 'bottom-full right-0 mb-1'
    :                          'bottom-full left-0 mb-1'

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={`row-actions-${id}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(v => !v)
        }}
        className={
          `w-6 h-6 inline-flex items-center justify-center rounded-sharp text-ink-muted ` +
          `hover:text-ink hover:bg-rail-soft transition-colors ` +
          (showOnHoverOf
            ? `opacity-0 group-hover:opacity-100 ${open ? 'opacity-100' : ''} `
            : '') +
          (className ?? '')
        }
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="3"  cy="7" r="1.1" fill="currentColor" />
          <circle cx="7"  cy="7" r="1.1" fill="currentColor" />
          <circle cx="11" cy="7" r="1.1" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          id={`row-actions-${id}`}
          role="menu"
          className={`absolute z-50 min-w-[160px] bg-surface border border-hairline rounded-card overflow-hidden ${popoverPosition}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-1">
            {items.map(it => (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (it.disabled) return
                  setOpen(false)
                  it.onSelect()
                }}
                className={
                  `w-full h-9 flex items-center gap-2.5 px-2.5 rounded-sharp text-left text-[12.5px] ` +
                  (it.disabled ? 'opacity-50 cursor-not-allowed ' : 'hover:bg-rail-soft cursor-pointer ') +
                  (it.tone === 'destructive' ? 'text-accent ' : 'text-ink ')
                }
              >
                {it.icon ? <span className="text-ink-soft inline-flex">{it.icon}</span> : <span className="w-3.5" />}
                <span className="flex-1 truncate">{it.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* Common icons for the menus — exported so callers don't need to redraw
   them. Sized 14px to match the trigger. */
export const RowActionIcons = {
  archive: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.5 3.5h11v3h-11z M2.5 6.5v6h9v-6 M5.5 9h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  unarchive: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M1.5 3.5h11v3h-11z M2.5 6.5v6h9v-6 M7 8v3 M5.5 9.5L7 8l1.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  delete: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 3.5h9 M5 3.5V2h4v1.5 M3.5 3.5l.7 9h5.6l.7-9 M5.5 5.5v6 M8.5 5.5v6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  rename: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 11.5L11 3l-.5-.5L2 11l.5.5z M9 4.5l1 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  collection: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 3h10v8H2z M2 6h10 M5.5 3v8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  open: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 3h8v8H3z M5 6.5h4 M5 8.5h2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  restore: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 7a4 4 0 108-1 M3 4v3h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
}
