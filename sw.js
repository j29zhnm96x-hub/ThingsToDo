/*
  ThingsToDo Service Worker
  - Cache-first for app shell (offline support)
  - Network-first for JS (code updates load immediately)
  - Manual update support via SKIP_WAITING message
*/

const CACHE_NAME = 'thingstodo-v48';
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
  './src/main.js',
  './src/modules/app.js',
  './src/modules/router.js',
  './src/modules/stats.js',
  './src/modules/search.js',
  './src/modules/notifications.js',
  './src/modules/updater.js',
  './src/modules/data/db.js',
  './src/modules/data/idb.js',
  './src/modules/data/models.js',
  './src/modules/screens/inbox.js',
  './src/modules/screens/projects.js',
  './src/modules/screens/projectDetail.js',
  './src/modules/screens/archive.js',
  './src/modules/screens/settings.js',
  './src/modules/screens/stats.js',
  './src/modules/screens/search.js',
  './src/modules/screens/help.js',
  './src/modules/screens/debug.js',
  './src/modules/ui/dom.js',
  './src/modules/ui/modal.js',
  './src/modules/ui/confirm.js',
  './src/modules/ui/toast.js',
  './src/modules/ui/theme.js',
  './src/modules/ui/todoList.js',
  './src/modules/ui/todoMenu.js',
  './src/modules/ui/todoInfo.js',
  './src/modules/ui/todoEditor.js',
  './src/modules/ui/projectCard.js',
  './src/modules/ui/projectMenu.js',
  './src/modules/ui/pickProject.js',
  './src/modules/ui/pickDestination.js',
  './src/modules/ui/quickAdd.js',
  './src/modules/ui/smartAdd.js',
  './src/modules/ui/bulkAdd.js',
  './src/modules/ui/binModal.js',
  './src/modules/ui/voiceMemo.js',
  './src/modules/ui/confetti.js',
  './src/modules/ui/haptic.js',
  './src/modules/ui/calendarView.js',
  './src/modules/ui/pillReorder.js',
  './src/modules/logic/todoOps.js',
  './src/modules/logic/sorting.js',
  './src/modules/logic/recurrence.js',
  './src/modules/logic/localParser.js',
  './src/modules/logic/attachments.js',
  './src/modules/logic/aiClient.js',
  './src/modules/utils/i18n.js',
  './src/modules/utils/share.js',
  './src/modules/utils/image.js'
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

  const isNavigation = req.mode === 'navigate';
  const isScript = url.pathname.endsWith('.js');

  event.respondWith(
    (async () => {
      // For navigation requests (page loads), always serve index.html from cache
      // This handles hash routes like #inbox, #projects, etc.
      if (isNavigation) {
        const cached = await caches.match('./index.html');
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
        // If index.html not in cache, try network
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put('./index.html', res.clone());
          }
          return res;
        } catch {
          return new Response('Offline', { status: 503 });
        }
      }

      // For non-navigation requests, try cache first
      const cached = await caches.match(req);
      
      if (cached) {
        // Return cached version immediately
        // Also try to update cache in background
        try {
          const networkRes = await fetch(req);
          if (networkRes.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, networkRes.clone());
          }
        } catch {
          // Network failed, but we already have cached version — ignore
        }
        
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

      // Not in cache — try network
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
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});
