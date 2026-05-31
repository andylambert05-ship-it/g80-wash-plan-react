// Service worker for offline support
// Cache name includes a version — bump to force a refresh of cached assets
const CACHE = 'm3care-v1'
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

  // Network-first for wash-plan.json so data updates show when online,
  // but fall back to cache when offline.
  if (url.pathname.endsWith('wash-plan.json')) {
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

  // Cache-first for everything else (app shell, JS, CSS, icons)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        // Only cache same-origin successful responses
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return res
      }).catch(() => {
        // Offline and not cached — for navigation, serve the app shell
        if (request.mode === 'navigate') return caches.match(BASE + 'index.html')
      })
    })
  )
})
