/**
 * ThingsToDo Push Scheduler — Cloudflare Worker
 *
 * Endpoints:
 *   POST /subscribe   — save push subscription
 *   POST /unsubscribe — remove push subscription
 *   POST /schedule    — schedule a reminder
 *   POST /cancel      — cancel a reminder by taskId
 *   Cron (every 1m)   — send due notifications
 *
 * KV namespace binding: PUSH_SCHEDULES
 * Secrets: VAPID_PRIVATE_KEY (PEM), VAPID_PUBLIC_KEY (raw base64url)
 */

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

function pemToBinary(pem) {
  const b64 = pem.replace(/-----BEGIN [\w ]+-----/, '').replace(/-----END [\w ]+-----/, '').replace(/\s/g, '');
  return fromBase64url(b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
}

async function signVapidJWT(privateKeyPem, publicKeyRaw, endpoint) {
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: now + 43200,
    sub: 'mailto:push@thingstodo.app'
  }));
  const signingInput = `${header}.${payload}`;

  const pkcs8 = pemToBinary(privateKeyPem);
  const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));
  const signature = base64url(new Uint8Array(sig));

  return `${signingInput}.${signature}`;
}

async function encryptPayload(payload, sub) {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const serverKey = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublic = new Uint8Array(await crypto.subtle.exportKey('raw', serverKey.publicKey));

  const clientPublic = fromBase64url(sub.keys.p256dh);
  const clientKey = await crypto.subtle.importKey('raw', clientPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);

  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientKey }, serverKey.privateKey, 256));

  const auth = fromBase64url(sub.keys.auth);
  const prk = await hkdf(shared, auth, 'WebPush: info\0', 32);
  const cek = await hkdf(prk, auth, 'Content-Encoding: aes128gcm', 16);
  const nonce = await hkdf(prk, auth, 'Content-Encoding: nonce', 12);

  const cipherKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: new ArrayBuffer(0) }, cipherKey, plaintext);

  const rs = 4096;
  const body = new Uint8Array(16 + 65 + 4 + 1 + 12 + encrypted.byteLength);
  let offset = 0;
  body.set(salt, offset); offset += 16;
  body.set(serverPublic, offset); offset += 65;
  body[offset++] = (rs >> 24) & 0xFF;
  body[offset++] = (rs >> 16) & 0xFF;
  body[offset++] = (rs >> 8) & 0xFF;
  body[offset++] = rs & 0xFF;
  body[offset++] = encrypted.byteLength & 0xFF;
  body.set(nonce, offset); offset += 12;
  body.set(new Uint8Array(encrypted), offset);

  return body;
}

async function hkdf(salt, ikm, info, length) {
  const extractKey = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', extractKey, ikm));

  const expandKey = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const infoBytes = new TextEncoder().encode(info);
  let result = new Uint8Array(0);
  let t = new Uint8Array(0);

  for (let i = 1; result.length < length; i++) {
    const data = new Uint8Array(t.length + infoBytes.length + 1);
    data.set(t);
    data.set(infoBytes, t.length);
    data[data.length - 1] = i;
    t = new Uint8Array(await crypto.subtle.sign('HMAC', expandKey, data));
    result = new Uint8Array([...result, ...t]);
  }
  return result.slice(0, length);
}

async function sendPush(subData, payload) {
  const sub = typeof subData === 'string' ? JSON.parse(subData) : subData;
  const jwt = await signVapidJWT(VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, sub.endpoint);
  const encrypted = await encryptPayload(payload, sub);

  await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`
    },
    body: encrypted
  });
}

function endpointKey(endpoint) {
  const hash = [...new Uint8Array(new TextEncoder().encode(endpoint))]
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return `sub:${hash.slice(0, 16)}`;
}

function schedKey(taskId, endpoint) {
  return `sched:${taskId}:${endpointKey(endpoint)}`;
}

async function handleSubscribe(body) {
  const { subscription } = body;
  if (!subscription?.endpoint) return new Response('Missing subscription', { status: 400 });
  const key = endpointKey(subscription.endpoint);
  await PUSH_SCHEDULES.put(key, JSON.stringify(subscription));
  return new Response('OK');
}

async function handleUnsubscribe(body) {
  const { endpoint } = body;
  if (!endpoint) return new Response('Missing endpoint', { status: 400 });
  await PUSH_SCHEDULES.delete(endpointKey(endpoint));
  return new Response('OK');
}

async function handleSchedule(body) {
  const { endpoint, taskId, title, dueDate, type } = body;
  if (!endpoint || !taskId || !dueDate) return new Response('Missing fields', { status: 400 });

  const remindMs = new Date(dueDate).getTime();
  if (remindMs <= Date.now()) return new Response('In the past', { status: 400 });

  const key = schedKey(taskId, endpoint);
  const entry = JSON.stringify({ taskId, title, dueDate, remindMs, endpoint, type: type || 'due_date' });

  await PUSH_SCHEDULES.put(key, entry, { expirationTtl: Math.ceil((remindMs - Date.now()) / 1000) + 86400 });
  return new Response('OK');
}

async function handleCancel(body) {
  const { endpoint, taskId } = body;
  if (!taskId) return new Response('Missing taskId', { status: 400 });

  const list = await PUSH_SCHEDULES.list({ prefix: 'sched:' });
  for (const { name } of list.keys) {
    if (name.includes(`:${taskId}:`)) {
      await PUSH_SCHEDULES.delete(name);
    }
  }
  return new Response('OK');
}

async function handleCron() {
  const list = await PUSH_SCHEDULES.list({ prefix: 'sched:' });
  const now = Date.now();

  for (const { name } of list.keys) {
    const entry = await PUSH_SCHEDULES.get(name, 'text');
    if (!entry) continue;

    const data = JSON.parse(entry);
    if (data.remindMs > now) continue;

    const subKey = endpointKey(data.endpoint);
    const subData = await PUSH_SCHEDULES.get(subKey, 'text');
    if (subData) {
      try {
        await sendPush(subData, {
          title: data.title,
          body: 'This task is due now.',
          url: `/#goto-task/${data.taskId}`,
          taskId: data.taskId,
          type: data.type
        });
      } catch (e) {
        console.error('Push failed:', data.taskId, e.message);
      }
    }
    await PUSH_SCHEDULES.delete(name);
  }
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response('Not found', { status: 404 });
    const url = new URL(request.url);
    let body;
    try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
    switch (url.pathname) {
      case '/subscribe': return handleSubscribe(body);
      case '/unsubscribe': return handleUnsubscribe(body);
      case '/schedule': return handleSchedule(body);
      case '/cancel': return handleCancel(body);
      default: return new Response('Not found', { status: 404 });
    }
  },
  async scheduled() {
    await handleCron();
  }
};
