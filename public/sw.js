// Service worker for offline support
// Bump CACHE version on every deploy to purge stale assets
const CACHE = 'm3care-v5'
const BASE = '/g80-wash-plan-react/'

// Core files to pre-cache on install
const PRECACHE = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.webmanifest',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    // addAll() rejects atomically, so one missing asset would fail the whole
    // install and silently kill offline support. Cache entries individually and
    // tolerate misses instead.
    caches.open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((u) => cache.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
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

  // Network-first for HTML so a new build is picked up immediately; falls back
  // to cache when offline. Plan data is no longer a file - it comes from the
  // Worker on a different origin and is never cached here.
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
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
