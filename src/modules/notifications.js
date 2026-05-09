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
