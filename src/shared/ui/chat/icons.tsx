/**
 * Tiny inline SVGs ported verbatim from `chat-workspace-G2M12.jsx`.
 *
 * These match the reference exactly — same viewBox, same stroke width — so
 * the Anthology workspace stays visually identical.
 */
import type { ReactNode } from 'react'

export const I: Record<
  | 'home'
  | 'proj'
  | 'chats'
  | 'hist'
  | 'gal'
  | 'plus'
  | 'search'
  | 'mic'
  | 'attach'
  | 'settings'
  | 'caret'
  | 'share'
  | 'config'
  | 'close'
  | 'doc',
  ReactNode
> = {
  home: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M1.5 6.5 6.5 2l5 4.5V11a1 1 0 0 1-1 1H8.5V8.5h-4V12H2.5a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
  proj: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M1.5 3.5h3l1 1h6v6a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
  chats: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3h9v6H6L3 11.5V9H2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
  hist: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6.5 3.5v3l2 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  gal: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1.5" y="2.5" width="10" height="8" stroke="currentColor" strokeWidth="1.1" />
      <path d="M1.5 8.5 4 6l2 2 2-2.5 3.5 3.5" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <circle cx="4.5" cy="5" r=".7" fill="currentColor" />
    </svg>
  ),
  plus: (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <circle cx="4.5" cy="4.5" r="3.2" stroke="currentColor" strokeWidth="1.1" />
      <path d="m7 7 2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  mic: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="5" y="1.5" width="3" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3 6.5a3.5 3.5 0 0 0 7 0M6.5 10v1.5M5 11.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  attach: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M8.5 4.5 4.5 8.5a2 2 0 0 0 2.83 2.83l4.59-4.59a3.5 3.5 0 1 0-4.95-4.95L2.4 6.36a5 5 0 0 0 7.07 7.07" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="1.4" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6.5 1.5v1.5M6.5 10v1.5M1.5 6.5h1.5M10 6.5h1.5M3 3l1 1M9 9l1 1M3 10l1-1M9 4l1-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  caret: (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
      <path d="M1.5 3 4 5.5 6.5 3" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  share: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M3 6.5v4a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-4M6.5 1.5v7M4 4l2.5-2.5L9 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  // Note: `config` icon uses a small filled-circle that needs the active palette
  // bg as its inner colour. We render it as a function in ChatWorkspace, not here.
  config: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3.5h9M2 6.5h9M2 9.5h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="9" cy="9.5" r="1.4" fill="transparent" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  ),
  close: (
    <svg width="11" height="11" viewBox="0 0 11 11">
      <path d="m2 2 7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  doc: (
    <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
      <path d="M1 1h6l3 3v8H1z" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
}
