/*
  Offline-first service worker:
  - Network-first for JS (so code updates load immediately)
  - Cache-first for other assets
  - Network fallback for offline
*/

// IMPORTANT: bump this to force clients to pick up new JS/CSS.
const CACHE_NAME = 'thingstodo-v46';

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

// ── Scheduled Reminders ───────────────────────────────────────────

const REMINDER_CACHE = 'thingstodo-reminders';

async function getScheduled() {
  const cache = await caches.open(REMINDER_CACHE);
  const req = new Request('/__reminders__');
  const res = await cache.match(req);
  if (!res) return {};
  try { return await res.json(); } catch { return {}; }
}

async function saveScheduled(reminders) {
  const cache = await caches.open(REMINDER_CACHE);
  const body = JSON.stringify(reminders);
  await cache.put(new Request('/__reminders__'), new Response(body, { headers: { 'Content-Type': 'application/json' } }));
}

async function checkDueReminders() {
  const reminders = await getScheduled();
  const now = Date.now();
  const due = [];
  const remaining = {};
  for (const [id, r] of Object.entries(reminders)) {
    if (r.remindMs <= now) {
      due.push(r);
    } else {
      remaining[id] = r;
    }
  }
  if (due.length === 0) return;
  await saveScheduled(remaining);
  for (const r of due) {
    self.registration.showNotification(r.title || 'ThingsToDo', {
      body: r.body || 'This task is due now.',
      icon: './assets/icon-192.png',
      badge: './assets/icon-192.png',
      tag: 'reminder-' + r.taskId,
      data: { url: r.url || '/' }
    });
  }
}

function scheduleSWTimer(reminders) {
  const now = Date.now();
  let nextMs = Infinity;
  for (const r of Object.values(reminders)) {
    const ms = r.remindMs - now;
    if (ms > 0 && ms < nextMs) nextMs = ms;
  }
  if (nextMs < Infinity) {
    setTimeout(async () => {
      await checkDueReminders();
      const rem = await getScheduled();
      const stillHas = Object.keys(rem).length > 0;
      if (stillHas) scheduleSWTimer(rem);
    }, Math.min(nextMs, 60000));
  }
}

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'schedule-reminder') return;
  event.waitUntil((async () => {
    const reminders = await getScheduled();
    reminders[event.data.taskId] = {
      taskId: event.data.taskId,
      title: event.data.title,
      body: event.data.body,
      remindMs: event.data.remindMs,
      url: event.data.url
    };
    await saveScheduled(reminders);
    // Clean up old due timers and set new one
    checkDueReminders();
    scheduleSWTimer(reminders);
  })());
});

self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'cancel-reminder') return;
  event.waitUntil((async () => {
    const reminders = await getScheduled();
    delete reminders[event.data.taskId];
    await saveScheduled(reminders);
  })());
});

// Check for missed reminders on activate (app was closed for a while)
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => (key === CACHE_NAME || key === REMINDER_CACHE) ? null : caches.delete(key)));
    await self.clients.claim();
    await checkDueReminders();
    const rem = await getScheduled();
    if (Object.keys(rem).length > 0) scheduleSWTimer(rem);
  })());
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
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // Navigate if possible, then focus
        if (client.url !== urlToOpen && 'navigate' in client) {
          client.navigate(urlToOpen);
        }
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
