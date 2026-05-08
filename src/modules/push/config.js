// Push notification configuration.
// Uses Service Worker for local reminders + Pages Functions for push.

export const PUSH_CONFIG = {
  apiBase: 'https://thingstodoapp.pages.dev/api',

  vapidPublicKey: 'BITp4PXYUt-fqt77OBIt1-T2EWEsd_VR6jSKuj5VF-kUImbyiimU1FrYB0cJHYKbsmUWwAb1fdhf8988kZCuQBc',

  vapidSubject: 'mailto:push@thingstodo.app'
};
