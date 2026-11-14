import type { ConsentCategory } from './types'

/**
 * Every cookie, storage key and tracker Omma uses, in one list. The banner
 * dialog, /settings and /cookies render from it, and withdrawing consent
 * purges whatever is listed under that category. Add new entries here
 * BEFORE shipping code that writes them.
 *
 * `match` is the literal key, or a prefix when it ends with `*`.
 */
export interface StorageEntry {
  match: string
  kind: 'cookie' | 'localStorage' | 'sessionStorage' | 'script'
  category: ConsentCategory
  provider: string
  purpose: string
  duration: string
}

export const REGISTRY: StorageEntry[] = [
  // ── Strictly necessary ────────────────────────────────────────────────
  { match: 'sb-*', kind: 'cookie', category: 'necessary', provider: 'Omma (Supabase Auth)', purpose: 'Keeps you signed in and refreshes your session securely.', duration: 'Until you sign out, refreshed while active' },
  { match: 'clox_consent', kind: 'cookie', category: 'necessary', provider: 'Omma', purpose: 'Remembers your cookie choices so every page and tab follows them.', duration: '6 months' },
  { match: 'clox_region', kind: 'cookie', category: 'necessary', provider: 'Omma', purpose: 'Country-level hint (never your address) that decides which privacy rules and wording apply.', duration: 'Browser session' },
  { match: 'clox.consent.v2', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Copy of your cookie choices with the date and a consent ID you can quote.', duration: '6 months' },
  { match: 'chat-history-*', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Messages of chats you open, so they load instantly and survive a reload.', duration: 'Until you delete the chat' },
  { match: 'chat-settings-*', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Model and options you picked for each chat.', duration: 'Until you delete the chat' },
  { match: 'activeChatId*', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Which chat was open, so you return to it.', duration: 'Until replaced' },
  { match: 'clox_chats', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Your chat list for offline and fast loading.', duration: 'Until you delete chats' },
  { match: 'sidebar-chats', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Chats shown in the sidebar.', duration: 'Until you delete chats' },
  { match: 'deleted-items', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Items you moved to Archives, so they stay hidden.', duration: 'Until you restore or delete them' },
  { match: 'project-settings-*', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Settings of projects you work in.', duration: 'Until you delete the project' },
  { match: 'project-db-id-*', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Links a chat to its saved project.', duration: 'Until you delete the chat' },
  { match: 'clox.preview.*', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Artifact previews you opened.', duration: 'Until replaced' },
  { match: 'clox.profile.tick', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Tells other open tabs your profile changed.', duration: 'Moments' },
  { match: 'clox:toolsState', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Tools you switched on in the composer.', duration: 'Until changed' },
  { match: 'selected*ModelId', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'The text, image, video and audio models you chose.', duration: 'Until changed' },
  { match: 'clox-palette', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'The theme you chose, applied before the page paints.', duration: 'Until changed' },
  { match: 'theme', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'Older copy of your light / dark choice.', duration: 'Until changed' },
  { match: 'clox.language', kind: 'localStorage', category: 'necessary', provider: 'Omma', purpose: 'The language you chose.', duration: 'Until changed' },

  // ── Analytics (loaded only with consent) ──────────────────────────────
  { match: 'Vercel Web Analytics', kind: 'script', category: 'analytics', provider: 'Vercel', purpose: 'Counts page views and referrers. No cookies, no cross-site identifier; private parts of addresses removed.', duration: 'No storage on your device' },
  { match: 'Vercel Speed Insights', kind: 'script', category: 'analytics', provider: 'Vercel', purpose: 'Measures how fast pages load and respond (Core Web Vitals).', duration: 'No storage on your device' },
]

export function entriesFor(category: ConsentCategory): StorageEntry[] {
  return REGISTRY.filter((e) => e.category === category)
}

/** Does a stored key match an entry pattern (`*` = any run of characters)? */
export function matches(pattern: string, key: string): boolean {
  if (!pattern.includes('*')) return pattern === key
  const re = new RegExp('^' + pattern.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$')
  return re.test(key)
}
