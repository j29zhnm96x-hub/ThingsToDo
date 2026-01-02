
// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function subscribeToPush(vapidPublicKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser.');
  }

  const registration = await navigator.serviceWorker.ready;
  
  // Check existing subscription
  let subscription = await registration.pushManager.getSubscription();
  
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });
  }
  
  return subscription;
}

export async function scheduleChecklistReminder(projectId) {
  if (!('serviceWorker' in navigator)) return;
  
  // 2 minutes in milliseconds
  const DELAY_MS = 2 * 60 * 1000;
  const title = 'Review the last CheckList';
  const body = 'You created a checklist recently. Tap to review it.';
  const targetUrl = `${location.origin}/#project/${projectId}`;

  const registration = await navigator.serviceWorker.ready;

  // Check permission
  if (Notification.permission !== 'granted') return;

  // Try to use Notification Triggers (experimental, works on some Androids)
  // This allows the notification to fire even if the app is killed.
  try {
    if ('showTrigger' in Notification.prototype) {
      const timestamp = Date.now() + DELAY_MS;
      await registration.showNotification(title, {
        body,
        icon: './assets/icon-192.png',
        badge: './assets/icon-192.png',
        showTrigger: new TimestampTrigger(timestamp),
        data: { url: targetUrl }
      });
      return;
    }
  } catch (e) {
    // Fallback if triggers aren't supported
  }

  // Fallback: setTimeout
  // NOTE: On iOS PWA, this only works if the app stays in memory (foreground or background).
  // If the user swipes the app away, this timer dies.
  setTimeout(() => {
    registration.showNotification(title, {
      body,
      icon: './assets/icon-192.png',
      badge: './assets/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: targetUrl }
    });
  }, DELAY_MS);
}

