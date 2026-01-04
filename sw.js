/*
  Offline-first service worker:
  - Network-first for JS (so code updates load immediately)
  - Cache-first for other assets
  - Network fallback for offline
*/

// IMPORTANT: bump this to force clients to pick up new JS/CSS.
const CACHE_NAME = 'thingstodo-v26';

// Keep this list small and stable; it's the offline app shell.
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

  // Use NETWORK-FIRST for JS files so code updates are picked up immediately.
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
        // Safari fix: "Response served by service worker has redirections"
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
        
        // Safari fix: If response is redirected, recreate it to strip the 'redirected' flag
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
      } catch (err) {
        const fallback = await caches.match('./index.html');
        return fallback || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'ThingsToDo', body: event.data ? event.data.text() : 'New notification' };
  }

  const title = data.title || 'ThingsToDo';
  const options = {
    body: data.body || 'Open app to see your tasks',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
