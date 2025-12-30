/*
  Offline-first service worker:
  - Cache app shell (HTML/CSS/JS/manifest/icons)
  - Cache-first for same-origin GET requests
  - Network fallback (useful during development)
*/

const CACHE_NAME = 'thingstodo-v1';

// Keep this list small and stable; it’s the offline app shell.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icon.svg',
  './assets/apple-touch-icon.png',
  './assets/favicon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png',
  './src/styles.css',
  './src/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Cache individually so missing optional assets (like extra icon sizes)
      // don't cause the whole install to fail.
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const res = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        // Cache static-ish requests; avoid caching opaque stuff.
        if (res.ok && res.type !== 'opaque') {
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        // If offline and request misses cache, fall back to app shell.
        const fallback = await caches.match('./index.html');
        return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});
