import { PUSH_CONFIG } from './config.js';

let _currentSubscription = null;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getSubscription() {
  if (_currentSubscription) return _currentSubscription;
  const reg = await navigator.serviceWorker.ready;
  _currentSubscription = await reg.pushManager.getSubscription();
  return _currentSubscription;
}

/** Subscribe to push notifications via the Cloudflare Worker. */
export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window))
    throw new Error('Push not supported');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUSH_CONFIG.vapidPublicKey)
    });
  }

  _currentSubscription = sub;

  // Send subscription to Worker
  await fetch(`${PUSH_CONFIG.workerUrl}/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() })
  });

  return true;
}

/** Unsubscribe from push notifications. */
export async function unsubscribeFromPush() {
  const sub = await getSubscription();
  if (sub) {
    await fetch(`${PUSH_CONFIG.workerUrl}/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint })
    });
    await sub.unsubscribe();
    _currentSubscription = null;
  }
  return true;
}

/** Schedule a reminder for a task at its due date */
export async function scheduleReminder(todo) {
  if (!todo.dueDate || !todo.id) return;
  if (!('serviceWorker' in navigator)) return;

  const sub = await getSubscription();
  if (!sub) return;

  try {
    await fetch(`${PUSH_CONFIG.workerUrl}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        taskId: todo.id,
        title: todo.title,
        dueDate: todo.dueDate,
        // Remind 15 minutes before due if it has a time, otherwise at start of day
        remindAt: todo.dueDate,
        type: 'due_date'
      })
    });
  } catch (e) {
    console.warn('Failed to schedule reminder:', e);
  }
}

/** Cancel a scheduled reminder */
export async function cancelReminder(taskId) {
  if (!taskId) return;
  const sub = await getSubscription();
  if (!sub) return;

  try {
    await fetch(`${PUSH_CONFIG.workerUrl}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, taskId })
    });
  } catch (e) {
    console.warn('Failed to cancel reminder:', e);
  }
}

/** Check if push is currently subscribed */
export async function isSubscribed() {
  const sub = await getSubscription();
  return !!sub;
}
