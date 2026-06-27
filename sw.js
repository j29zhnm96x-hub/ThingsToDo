/*
  ThingsToDo Service Worker
  - Precaches app shell for offline support
  - Cache-first for static assets
  - Navigation requests always serve index.html (SPA)
*/

const CACHE_NAME = 'thingstodo-v49';

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
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
      ))
      .then(() => self.clients.claim())
  );
});

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

  // Navigation requests (page loads) always serve index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html')
        .then(cached => cached || fetch(req))
        .catch(() => new Response('Offline', { status: 503 }))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (!res.ok || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        return res;
      });
    }).catch(() => new Response('Offline', { status: 503 }))
  );
});
