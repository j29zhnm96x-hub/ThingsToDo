// Service Worker update management
// Forces a fresh SW install by using a unique URL per deploy,
// bypassing all caches (CDN, browser, SW internal).

// IMPORTANT: Bump this with every deploy to force PWA update detection
const SW_BUILD = 10;

let registration = null;

function swUrl() {
  return `./sw.js?_ts=${SW_BUILD}`;
}

/**
 * Register the service worker using a cache-busting URL.
 * Call once at startup.
 */
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // Clean up any old SW registrations on the non-versioned URL
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      if (reg.active && reg.active.scriptURL && !reg.active.scriptURL.includes(`_ts=${SW_BUILD}`)) {
        await reg.unregister();
      }
    }
    registration = await navigator.serviceWorker.register(swUrl(), {
      scope: './',
      updateViaCache: 'none'
    });
    return registration;
  } catch (err) {
    console.warn('SW registration failed:', err);
    return null;
  }
}

/**
 * Check for updates by clearing all caches, unregistering old SWs,
 * then re-registering with a fresh versioned URL.
 * Returns { updated: boolean, error?: string }
 */
export async function checkForUpdates() {
  if (!('serviceWorker' in navigator)) {
    return { updated: false, error: 'unsupported' };
  }

  try {
    // 1. Clear all caches (app shell, old SW caches, everything)
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));

    // 2. Unregister ALL existing service workers
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));

    // 3. Register fresh SW with versioned URL (bypasses all caches)
    registration = await navigator.serviceWorker.register(swUrl(), {
      scope: './',
      updateViaCache: 'none'
    });

    // 4. Wait briefly for the new SW to install + activate (skipWaiting in sw.js)
    if (registration.installing) {
      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 4000);
        registration.installing.addEventListener('statechange', () => {
          if (registration.installing && registration.installing.state === 'activated') {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }

    return { updated: true };
  } catch (err) {
    console.warn('Update check failed:', err);
    return { updated: false, error: String(err) };
  }
}

/**
 * Show a fancy full-screen update overlay, then reload.
 * Call this after checkForUpdates() succeeds.
 */
export function showUpdateOverlayAndReload() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'update-overlay';
    overlay.innerHTML = `<div class="update-overlay__text" id="updateText">Updated successfully</div>`;
    document.body.appendChild(overlay);

    setTimeout(() => {
      window.location.reload();
      resolve();
    }, 1200);
  });
}

/**
 * Get the current SW state info
 */
export function getUpdateInfo() {
  if (!('serviceWorker' in navigator)) {
    return { supported: false, version: null, build: null };
  }
  return {
    supported: true,
    version: '1.0.0',
    build: SW_BUILD,
    registered: !!registration
  };
}
