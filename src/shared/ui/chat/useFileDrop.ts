'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * useFileDrop — page-level drag-and-drop state for the chat surface.
 *
 * The wiring is fiddlier than it looks for one reason: the browser
 * fires `dragenter` and `dragleave` for EVERY descendant a dragged
 * pointer crosses, not just the element you bound the listeners to.
 * If you naively flip `dragActive` on enter/leave the overlay will
 * flicker on and off as the cursor moves between the chat header,
 * the messages list, and the composer.
 *
 * Standard fix is a counter: increment on `dragenter`, decrement on
 * `dragleave`, only switch the visible state when the counter
 * crosses zero. We use a ref (not state) so the counter doesn't
 * trigger React re-renders on every nested boundary crossing — only
 * the boolean transitions do.
 *
 * Files are filtered to:
 *   - `dataTransfer.files` (real OS files, what every chat composer
 *     accepts) — items dragged from another browser tab show up as
 *     `text/uri-list` instead and would crash `onAttach(FileList)`,
 *     so we skip those silently.
 *   - At least one file present — protects against bogus drag
 *     sessions that fire enter/over without ever carrying payload.
 */
export function useFileDrop({
  onFiles,
  enabled = true,
}: {
  /** Called once when a valid file drop completes. */
  onFiles?: (files: FileList) => void
  /** When false, the hook turns into an inert pass-through — the
   *  drop overlay never appears and dropped files fall through to
   *  the browser's default behaviour. We use this to disable
   *  attachments for chats that don't accept them yet (e.g. some
   *  voice-only modes). */
  enabled?: boolean
}) {
  const [active, setActive] = useState(false)
  // The descendant-counter trick described in the file header.
  const depth = useRef(0)

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!enabled || !onFiles) return
    // `Files` in `types` is the cross-browser signal that the drag
    // actually carries OS-level files. Without this guard we'd flash
    // the overlay when a user drags text within the page.
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    depth.current += 1
    if (depth.current === 1) setActive(true)
  }, [enabled, onFiles])

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!enabled || !onFiles) return
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    // preventDefault here is the magic that lets `drop` actually fire
    // — without it the browser refuses the drop and the overlay
    // never delivers anything. Setting `dropEffect=copy` also gives
    // the cursor a green "+" affordance during the drag.
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [enabled, onFiles])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!enabled || !onFiles) return
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    depth.current = Math.max(0, depth.current - 1)
    if (depth.current === 0) setActive(false)
  }, [enabled, onFiles])

  const onDrop = useCallback((e: React.DragEvent) => {
    if (!enabled || !onFiles) return
    e.preventDefault()
    depth.current = 0
    setActive(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) onFiles(files)
  }, [enabled, onFiles])

  return {
    active,
    handlers: { onDragEnter, onDragOver, onDragLeave, onDrop },
  }
}
