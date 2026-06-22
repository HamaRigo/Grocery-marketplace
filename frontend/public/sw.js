const CACHE = 'bakala-v1'
const SHELL = ['/', '/src/main.tsx']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Network-first: try network, fall back to cache, skip API calls
self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET, cross-origin, and API requests
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return
  if (/^\/(auth|stores|catalog|inventory|cart|orders|fulfillment|tracking|billing|reports|health|discovery|notifications|scheduling)/.test(url.pathname)) return

  e.respondWith(
    fetch(request)
      .then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(request, clone))
        return res
      })
      .catch(() => caches.match(request))
  )
})
