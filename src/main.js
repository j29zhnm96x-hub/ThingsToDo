import { initApp } from './modules/app.js';
import { registerSW } from './modules/updater.js';

// Register service worker for offline support and update management.
registerSW();

initApp(document.querySelector('[data-js="app"]'));
