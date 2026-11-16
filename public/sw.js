/* ClipPro service worker — offline shell for the editor.
 * Strategy:
 *  - Navigations: network first, fall back to the cached app shell.
 *  - Same-origin assets: stale-while-revalidate so the app boots offline
 *    after the first visit while still picking up new builds.
 *  - Cross-origin: pass through (fonts are bundled same-origin by Vite).
 */
const VERSION = 'clippro-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`
const SHELL_URLS = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL).then((cache) => cache.put('/index.html', copy)).catch(() => undefined)
          return response
        })
        .catch(async () => (await caches.match('/index.html')) ?? (await caches.match('/')) ?? Response.error()),
    )
    return
  }

  event.respondWith(
    caches.open(ASSETS).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone()).catch(() => undefined)
          return response
        })
        .catch(() => undefined)
      return cached ?? (await network) ?? Response.error()
    }),
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'clippro:skip-waiting') self.skipWaiting()
})
