/*
  ThingsToDo Service Worker
  - Cache-first for app shell (offline support)
  - Network-first for JS (code updates load immediately)
  - Manual update support via SKIP_WAITING message
*/

const CACHE_NAME = 'thingstodo-v47';
const APP_VERSION = '1.0.0';

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
      await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => (key === CACHE_NAME || key.startsWith('thingstodo-') && key < CACHE_NAME) ? caches.delete(key) : null));
      await self.clients.claim();
    })()
  );
});

// Manual update: activate immediately when told
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isScript = url.pathname.endsWith('.js');

  event.respondWith(
    (async () => {
      if (isScript) {
        // Network-first for scripts
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          const cached = await caches.match(req);
          return cached || new Response('Offline', { status: 503 });
        }
      }

      // Cache-first for everything else
      const cached = await caches.match(req);
      if (cached) {
        if (cached.redirected) {
          const body = await cached.blob();
          return new Response(body, {
            status: cached.status,
            statusText: cached.statusText,
            headers: cached.headers
          });
        }
        return cached;
      }

      try {
        let res = await fetch(req);
        if (res.redirected) {
          const body = await res.blob();
          res = new Response(body, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers
          });
        }
        const cache = await caches.open(CACHE_NAME);
        if (res.ok && res.type !== 'opaque') {
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const fallback = await caches.match('./index.html');
        return fallback || new Response('Offline', { status: 503 });
      }
    })()
  );
});
