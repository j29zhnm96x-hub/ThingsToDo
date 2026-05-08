
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

  if (Notification.permission !== 'granted') return;

  // Try push-based schedule via Worker (works even when app is closed)
  try {
    const { scheduleReminder } = await import('./push/push.js');
    await scheduleReminder({
      id: projectId,
      title: 'Review the last CheckList',
      dueDate: new Date(Date.now() + 120000).toISOString()
    });
    return;
  } catch (e) {
    // Fallback to local notification
  }

  // Fallback: setTimeout
  const DELAY_MS = 2 * 60 * 1000;
  const title = 'Review the last CheckList';
  const body = 'You created a checklist recently. Tap to review it.';
  const targetUrl = `${location.origin}/#project/${projectId}`;

  const registration = await navigator.serviceWorker.ready;
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

