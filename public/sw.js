/*
 * Omma service worker.
 *
 * - Pages: always from the network (chats and sign-in must be live); when the
 *   phone is offline, the offline page is shown instead of the browser error.
 * - Built files under /_next/static have a content hash in their name, so a
 *   cached copy can never be stale: served from cache, fetched once.
 * - Icons and brand files: cache, refreshed in the background.
 * - Everything else (API calls, streams, uploads) is never touched.
 */
const VERSION = 'omma-v2'
const SHELL = `${VERSION}-shell`
const STATIC = `${VERSION}-static`
const PRECACHE = ['/offline.html', '/icons/icon-192.png', '/icons/icon-512.png', '/brand/omma-mark-primary.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline.html')))
    return
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req)
        if (hit) return hit
        const res = await fetch(req)
        if (res.ok) cache.put(req, res.clone())
        return res
      }),
    )
    return
  }

  if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/')) {
    event.respondWith(
      caches.open(SHELL).then(async (cache) => {
        const hit = await cache.match(req)
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone())
            return res
          })
          .catch(() => hit)
        return hit || fresh
      }),
    )
  }
})
