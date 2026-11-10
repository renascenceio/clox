'use client'

import { useSyncExternalStore } from 'react'
import type { DownloadStripFile } from '@/shared/ui/components/file-preview'

/**
 * The file shown in the side preview panel. Replies open files from deep
 * inside the transcript; the panel lives in the shell beside the chat, so
 * they meet here.
 */

export type PreviewState = { files: DownloadStripFile[]; index: number } | null

let state: PreviewState = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

export function openPreview(files: DownloadStripFile[], index: number) {
  if (!files[index]) return
  state = { files, index }
  emit()
}

export function selectPreview(index: number) {
  if (!state || !state.files[index]) return
  state = { ...state, index }
  emit()
}

export function closePreview() {
  if (state === null) return
  state = null
  emit()
}

export function usePreview(): PreviewState {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => state,
    () => null,
  )
}

/** Files already opened automatically, so a reply opens its deck once —
 *  not again on every re-render or when the chat is revisited. */
export const autoOpened = new Set<string>()
