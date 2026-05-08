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

async function api(path, body) {
  try {
    const res = await fetch(`${PUSH_CONFIG.apiBase}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Subscribe to push notifications. */
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
  await api('/subscribe', { subscription: sub.toJSON() });
  return true;
}

/** Unsubscribe from push notifications. */
export async function unsubscribeFromPush() {
  const sub = await getSubscription();
  if (sub) {
    await api('/unsubscribe', { endpoint: sub.endpoint });
    await sub.unsubscribe();
    _currentSubscription = null;
  }
  return true;
}

/** Schedule a reminder — stores in SW + Cloudflare Pages KV. */
export async function scheduleReminder(todo) {
  if (!todo.dueDate || !todo.id) return;
  const remindMs = new Date(todo.dueDate).getTime();
  if (remindMs <= Date.now()) return;

  // Store in SW (offline fallback)
  const reg = await navigator.serviceWorker.ready;
  if (reg.active) {
    reg.active.postMessage({
      type: 'schedule-reminder',
      taskId: todo.id,
      title: todo.title,
      body: 'This task is due now.',
      remindMs,
      url: `/#goto-task/${todo.id}`
    });
  }

  // Also schedule via Pages Function (for when app is closed)
  await api('/schedule', { taskId: todo.id, title: todo.title, dueDate: todo.dueDate });
}

/** Cancel a scheduled reminder */
export async function cancelReminder(taskId) {
  if (!taskId) return;
  const reg = await navigator.serviceWorker.ready;
  if (reg.active) reg.active.postMessage({ type: 'cancel-reminder', taskId });
  await api('/cancel', { taskId });
}

/** Check if push is currently subscribed */
export async function isSubscribed() {
  const sub = await getSubscription();
  return !!sub;
}
