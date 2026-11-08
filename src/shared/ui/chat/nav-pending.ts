'use client'

import { useSyncExternalStore } from 'react'

/**
 * The page the user just asked for, while its code and data load. The
 * shell draws a ghost of the next page at once instead of leaving the old
 * one on screen with no sign the click landed.
 */

let pending: string | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

function pathOf(href: string) {
  try {
    return new URL(href, window.location.href).pathname
  } catch {
    return href
  }
}

export function beginNav(href: string) {
  if (typeof window === 'undefined') return
  const path = pathOf(href)
  if (path === window.location.pathname) return
  pending = path
  if (timer) clearTimeout(timer)
  // A navigation that never lands (error, redirect to the same page) must
  // not leave the ghost up.
  timer = setTimeout(endNav, 12_000)
  emit()
}

export function endNav() {
  if (pending === null) return
  pending = null
  if (timer) clearTimeout(timer)
  emit()
}

export function useNavPending() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    () => pending,
    () => null,
  )
}

/** Rail item ids by the path they open. */
export const NAV_ID_BY_PATH: Record<string, string> = {
  '/projects': 'projects',
  '/text': 'chats',
  '/history': 'history',
  '/files': 'files',
  '/gallery': 'gallery',
}

/** Pages people move between most; their code is fetched ahead of a click. */
export const PREFETCH_PATHS = ['/text', '/projects', '/history', '/files', '/gallery', '/settings', '/skills']
