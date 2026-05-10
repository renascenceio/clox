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
 * Positioning:
 *   The popover renders into `document.body` via a React Portal and is
 *   positioned with `position: fixed` against the trigger's bounding
 *   rect. This is deliberate — earlier versions used `position: absolute`
 *   inside the trigger's wrapper which got CLIPPED by any ancestor
 *   `overflow: auto / hidden / scroll` container. Pages like /archives
 *   wrap their list in a scroll container, so the menu would disappear
 *   under the bottom edge for any row near the fold.
 *
 *   With fixed-positioning + portal:
 *     – The menu escapes every scroll/overflow context up to the body.
 *     – We auto-flip up→down or right→left when the requested side
 *       would push it past the viewport edge.
 *     – Window scroll/resize closes it (the rect would be stale).
 */

import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type ReactNode, type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'

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
  /** Where to anchor the popover. Defaults to `bottom-right`. The menu
   *  auto-flips when the chosen side would clip outside the viewport. */
  side?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  /** Optional className passthrough on the trigger button. */
  className?: string
  /** Only show the trigger when an ancestor with this attribute is hovered.
   *  When unset, the trigger is always visible. */
  showOnHoverOf?: string
}

/* The popover dimensions used for boundary maths. We don't measure the
 * actual rendered node because the popover doesn't exist until after it
 * opens — these fixed numbers match the menu's intrinsic sizing
 * (min-w-[160px], 9px row × N rows + 8px padding). */
const MENU_WIDTH       = 180
const MENU_ROW_HEIGHT  = 36   // 9 row * 4 (h-9 = 36px)
const MENU_PADDING_Y   = 8
const VIEWPORT_GUTTER  = 8    // keep this much breathing room from edges

export default function RowActionsMenu({
  items,
  title = 'More actions',
  side = 'bottom-right',
  className = '',
  showOnHoverOf,
}: RowActionsMenuProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef    = useRef<HTMLDivElement | null>(null)

  // Resolved fixed-position style; `null` until the menu actually opens
  // and we've measured the trigger's bounding rect.
  const [pos, setPos] = useState<CSSProperties | null>(null)

  // Recalculate the menu's fixed-position style from the trigger rect.
  // Pulled out so we can call it on every open and on every reflow event
  // (scroll / resize) without re-encoding the placement maths.
  const computePosition = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const rect = t.getBoundingClientRect()
    const menuHeight = items.length * MENU_ROW_HEIGHT + MENU_PADDING_Y
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Vertical: prefer the requested side, but flip if the menu would
    // overflow the viewport. With a portal the menu can escape any
    // ancestor overflow box, so the only constraint is the viewport
    // itself.
    const wantTop = side === 'top-right' || side === 'top-left'
    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    const goUp =
      wantTop
        ? spaceAbove >= menuHeight + VIEWPORT_GUTTER || spaceAbove >= spaceBelow
        : spaceBelow < menuHeight + VIEWPORT_GUTTER && spaceAbove > spaceBelow

    const top = goUp
      ? Math.max(VIEWPORT_GUTTER, rect.top - menuHeight - 4)
      : Math.min(vh - menuHeight - VIEWPORT_GUTTER, rect.bottom + 4)

    // Horizontal: align right edge to trigger's right (the default sidebar
    // pattern), or left edge to trigger's left for the *-left variants.
    // Then clamp to viewport gutters so we never spill off-screen.
    const wantLeftAlign = side === 'bottom-left' || side === 'top-left'
    let left = wantLeftAlign ? rect.left : rect.right - MENU_WIDTH
    left = Math.max(VIEWPORT_GUTTER, Math.min(left, vw - MENU_WIDTH - VIEWPORT_GUTTER))

    setPos({
      position: 'fixed',
      top,
      left,
      width: MENU_WIDTH,
    })
  }, [items.length, side])

  // Outside-click + escape ----------------------------------------------
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      // Click inside trigger? toggle handler will deal with it.
      if (triggerRef.current?.contains(target)) return
      // Click inside the menu? leave it open; the row's own onClick
      // closes after firing its handler.
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // Reflow on scroll/resize. We close instead of recomputing so a
    // user scrolling away doesn't have a phantom menu chasing them.
    const onReflow = () => setOpen(false)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown',   onKey)
    window.addEventListener('scroll',      onReflow, true)
    window.addEventListener('resize',      onReflow)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown',   onKey)
      window.removeEventListener('scroll',      onReflow, true)
      window.removeEventListener('resize',      onReflow)
    }
  }, [open])

  // Compute position synchronously on open so the menu paints once at
  // its final coordinates instead of jumping after measurement.
  useLayoutEffect(() => {
    if (open) computePosition()
    else setPos(null)
  }, [open, computePosition])

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
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

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          id={`row-actions-${id}`}
          role="menu"
          // z-50 alone isn't enough when the body has a fixed-position
          // chrome (sidebar, command palette overlays). z-[1000] keeps
          // the menu above everything except modal dialogs.
          className="z-[1000] bg-surface border border-hairline rounded-card overflow-hidden shadow-lg"
          style={pos}
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
        </div>,
        document.body,
      )}
    </span>
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
