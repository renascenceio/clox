/**
 * Permanent in-app links for files in the `chat-outputs` bucket. Safe to
 * import on the client.
 */

export function fileUrl(path: string, opts: { download?: boolean } = {}): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `/api/files/${encoded}${opts.download ? '?download=1' : ''}`
}

const SIGNED = /\/storage\/v1\/object\/sign\/chat-outputs\/([^?#]+)/

/** Old chats saved one-hour signed storage URLs; turn those into the
 *  permanent link so their previews and downloads keep working. */
export function stableFileUrl(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url
  const m = url.match(SIGNED)
  if (!m) return url
  const path = m[1].split('/').map(decodeURIComponent).join('/')
  return fileUrl(path)
}

/** JSON.parse for saved chats/histories that upgrades old signed links. */
export function parseStored<T>(raw: string): T {
  return JSON.parse(raw, (_k, v) =>
    typeof v === 'string' && v.includes('/object/sign/chat-outputs/') ? stableFileUrl(v) : v,
  ) as T
}

export function downloadUrl(url: string): string {
  const stable = stableFileUrl(url)
  if (!stable.startsWith('/api/files/')) return stable
  return stable.includes('?') ? stable : `${stable}?download=1`
}
