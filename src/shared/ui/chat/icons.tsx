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
  | 'doc'
  | 'user'
  | 'lang'
  | 'moon'
  | 'sun'
  | 'shield'
  | 'bulb'
  | 'door'
  | 'trash'
  | 'video'
  | 'check'
  | 'sparkle',
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
  user: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="4.5" r="2.2" stroke="currentColor" strokeWidth="1.1" />
      <path d="M2 11.5c.7-2.2 2.5-3.3 4.5-3.3s3.8 1.1 4.5 3.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  lang: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 10 4.5 3 7 10M3 8h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 6.5h4M10 5v8M8.5 8.5c.7 1.5 1.7 2.6 3 3M11.5 8.5c-.7 1.5-1.7 2.6-3 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  moon: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M10.5 7.8A4 4 0 0 1 5.2 2.5 4.5 4.5 0 1 0 10.5 7.8z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
  sun: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="2.2" stroke="currentColor" strokeWidth="1.1" />
      <path d="M6.5 1v1.5M6.5 10.5V12M1 6.5h1.5M10.5 6.5H12M2.7 2.7l1 1M9.3 9.3l1 1M2.7 10.3l1-1M9.3 3.7l1-1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  shield: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1.5 2 3v3.5c0 2.6 1.8 4.7 4.5 5.5C9.2 11.2 11 9.1 11 6.5V3z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
  bulb: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M4.5 8.5c-1-.6-1.7-1.7-1.7-3a3.7 3.7 0 1 1 7.4 0c0 1.3-.7 2.4-1.7 3v1.2H4.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M5 11.2h3M5.5 12.2h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  ),
  door: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M7 2.5H3v8h4M7 1.5v10" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M9 4.5l2.5 2-2.5 2M11 6.5H6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  trash: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3.5h9M5 3.5V2.2c0-.4.3-.7.7-.7h1.6c.4 0 .7.3.7.7v1.3M3.5 3.5l.5 7.3c0 .4.4.7.8.7h3.4c.4 0 .8-.3.8-.7l.5-7.3M5.5 5.5v4M7.5 5.5v4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  video: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1.5" y="3.5" width="7.5" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.1" />
      <path d="m9 6.5 3-1.5v3.5L9 7" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="m2 5.7 2.4 2.3L9 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  sparkle: (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1.5v3M6.5 8.5v3M1.5 6.5h3M8.5 6.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M6.5 4.5 8 6.5l-1.5 2L5 6.5z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  ),
}
