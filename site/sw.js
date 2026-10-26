/* The web app used to live at the site root and installed a service worker here.
   It now lives in app/ with its own. This one replaces the old worker and removes
   itself, so the promo page is never served from an old offline copy. Caches are
   left for the app's own worker to tidy up. */
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.unregister()
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then((clients) => clients.forEach((c) => c.navigate(c.url))))
})
