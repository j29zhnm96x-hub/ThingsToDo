// Push notification configuration.
// Uses Service Worker for local reminders + Pages Functions for push.

export const PUSH_CONFIG = {
  apiBase: 'https://thingstodoapp.pages.dev/api',

  vapidPublicKey: 'BJRwAeexC9A0eQiykJrQDTRq4WC9uhxeq1wA_vnbJJqfnJ35UJ2yLhYcNMx0aG6OhwrvwAAddVKYXIh0V8Nuv8M',

  vapidSubject: 'mailto:push@thingstodo.app'
};
