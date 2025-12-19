import { initApp } from './modules/app.js';

// Register service worker for offline support.
// Note: In development via file://, SW won’t work; serve over http(s).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./sw.js', { scope: './' });
    } catch (err) {
      // Keep silent: app should still function without SW.
      console.warn('Service worker registration failed:', err);
    }
  });
}

initApp(document.querySelector('[data-js="app"]'));
