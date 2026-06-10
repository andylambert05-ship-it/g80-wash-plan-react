// Service worker for offline support
// Bump CACHE version on every deploy to purge stale assets
const CACHE = 'm3care-v3'
const BASE = '/g80-wash-plan-react/'

// Core files to pre-cache on install
const PRECACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'wash-plan.json',
  BASE + 'manifest.webmanifest',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Network-first for HTML and wash-plan.json so updates show immediately.
  // Falls back to cache when offline.
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('wash-plan.json')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
          return res
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // Cache-first for everything else (JS bundles, CSS, icons, fonts)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return res
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match(BASE + 'index.html')
      })
    })
  )
})
