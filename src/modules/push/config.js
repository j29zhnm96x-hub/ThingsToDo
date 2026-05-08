// Push notification configuration.
// Set your Cloudflare Worker URL and VAPID public key after deployment.

export const PUSH_CONFIG = {
  // Worker URL — change after you deploy the Cloudflare Worker
  workerUrl: 'https://thingstodo-push.j29zhnm96x.workers.dev',

  // VAPID public key (generated once, shared with both Worker and clients)
  vapidPublicKey: 'BJRwAeexC9A0eQiykJrQDTRq4WC9uhxeq1wA_vnbJJqfnJ35UJ2yLhYcNMx0aG6OhwrvwAAddVKYXIh0V8Nuv8M',

  // VAPID contact email for push service identification
  vapidSubject: 'mailto:push@thingstodo.app'
};
