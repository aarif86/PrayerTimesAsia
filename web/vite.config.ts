import preact from '@preact/preset-vite'
import { createHash } from 'node:crypto'
import { defineConfig, type Plugin } from 'vite'

/**
 * Writes sw.js after the build with the list of files to keep offline, so the
 * app opens with no connection. No runtime dependencies, no workbox.
 */
function serviceWorker(): Plugin {
  return {
    name: 'ptasia-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'sw.js')
      const precache = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
        'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/badge-96.png',
        ...files.filter((f) => !f.endsWith('.html') && !/\.(woff2?)$/.test(f) || /latin-wght-normal/.test(f))]
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 12)
      const source = `/* Prayer Times Asia service worker (generated) */
const VERSION = ${JSON.stringify(version)}
const SHELL = 'ptasia-shell-' + VERSION
const TILES = 'ptasia-tiles-osm'
const PRECACHE = ${JSON.stringify([...new Set(precache)])}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => (k.startsWith('ptasia-shell-') && k !== SHELL) || (k.startsWith('ptasia-tiles') && k !== TILES)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()))
})

async function trimTiles() {
  const c = await caches.open(TILES)
  const keys = await c.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - 400))) await c.delete(k)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // The app itself: cache first (versioned), the page network first so updates arrive.
  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      event.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(SHELL).then((c) => c.put('index.html', copy)); return r })
        .catch(() => caches.match('index.html', { ignoreSearch: true })))
      return
    }
    event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(SHELL).then((c) => c.put(req, copy)) }
      return r
    })))
    return
  }
  // Map tiles: keep the last few hundred for offline use.
  if (url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(caches.open(TILES).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { c.put(req, r.clone()); trimTiles() }
      return r
    }))))
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) return c.focus()
    return self.clients.openWindow(self.registration.scope)
  }))
})
`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  base: process.env.BASE_PATH ?? '/PrayerTimesAsia/',
  plugins: [preact(), serviceWorker()],
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 300 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as Parameters<typeof defineConfig>[0])
