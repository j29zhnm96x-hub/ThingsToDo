// Service Worker update management
// Provides manual check-for-updates and auto-check on startup

let registration = null;

/**
 * Register the service worker and store the registration reference.
 * Call once at startup.
 */
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    registration = await navigator.serviceWorker.register('./sw.js', {
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
 * Check for a new service worker version.
 * Returns { updated: boolean, error?: string }
 * - updated: true if a new SW was found and activated
 * - If no SW support, returns { updated: false, error: 'unsupported' }
 */
export async function checkForUpdates() {
  if (!('serviceWorker' in navigator)) {
    return { updated: false, error: 'unsupported' };
  }

  // If we don't have a registration yet, try registering
  if (!registration) {
    await registerSW();
    if (!registration) return { updated: false, error: 'register_failed' };
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ updated: false, error: 'timeout' });
    }, 15000);

    // Listen for controllerchange — fires when a new SW takes over
    const onControllerChange = () => {
      clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      resolve({ updated: true });
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Listen for updatefound on the registration
    if (registration.installing || registration.waiting) {
      // An update is already waiting or installing
      clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      activateNewSW(registration).then((result) => {
        resolve(result);
      });
      return;
    }

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && registration.active) {
          // New SW is installed and waiting
          clearTimeout(timeout);
          navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
          activateNewSW(registration).then((result) => {
            resolve(result);
          });
        }
      });
    });

    // Trigger the update check
    registration.update().catch((err) => {
      clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      resolve({ updated: false, error: String(err) });
    });
  });
}

async function activateNewSW(reg) {
  if (reg.waiting) {
    // Send message to skip waiting
    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    // Wait for controllerchange
    return new Promise((resolve) => {
      const handler = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handler);
        resolve({ updated: true });
      };
      navigator.serviceWorker.addEventListener('controllerchange', handler);
      // Fallback: if controller doesn't change within 5s, consider it done
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', handler);
        resolve({ updated: true });
      }, 5000);
    });
  }
  // If installing but not yet installed, wait for it
  if (reg.installing) {
    return new Promise((resolve) => {
      reg.installing.addEventListener('statechange', () => {
        if (reg.installing.state === 'activated') {
          resolve({ updated: true });
        }
      });
    });
  }
  return { updated: false };
}

/**
 * Get the current SW state info
 */
export function getUpdateInfo() {
  if (!('serviceWorker' in navigator)) {
    return { supported: false, version: null };
  }
  return {
    supported: true,
    version: '1.0.0',
    registered: !!registration,
    hasUpdate: !!(registration && (registration.waiting || registration.installing))
  };
}
