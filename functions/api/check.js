function fromBase64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodePrivateKey(keyStr) {
  // Try as raw base64url DER first
  try {
    const raw = fromBase64url(keyStr);
    // Check if it looks like DER (PKCS8 starts with byte 0x30, SEQUENCE tag)
    if (raw.length > 10 && raw[0] === 0x30) return raw;
  } catch {}
  // Try as base64url-encoded PEM
  try {
    const pem = new TextDecoder().decode(fromBase64url(keyStr));
    const b64 = pem.replace(/-----BEGIN [\w ]+-----/, '').replace(/-----END [\w ]+-----/, '').replace(/\s/g, '');
    return fromBase64url(b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
  } catch {}
  // Try as plain PEM text
  try {
    const b64 = keyStr.replace(/-----BEGIN [\w ]+-----/, '').replace(/-----END [\w ]+-----/, '').replace(/\s/g, '');
    return fromBase64url(b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
  } catch {}
  throw new Error('Invalid PKCS8 input');
}

function toRawSig(sig) {
  // Cloudflare Workers returns ECDSA sig in P1363 format (raw 64-byte r||s)
  if (sig.length === 64) return sig;
  // Some implementations return DER-encoded signature
  if (sig.length > 64 && sig[0] === 0x30) {
    let offset = 1;
    if (sig[offset] & 0x80) offset += (sig[offset] & 0x7f) + 1;
    else offset++;
    if (sig[offset++] !== 0x02) return sig.slice(0, 64); // fallback
    let rLen = sig[offset++];
    let rStart = offset;
    if (rLen === 33 && sig[offset] === 0) { rStart++; rLen--; }
    offset += (rLen === 33 ? 33 : rLen);
    if (sig[offset++] !== 0x02) return sig.slice(0, 64);
    let sLen = sig[offset++];
    let sStart = offset;
    if (sLen === 33 && sig[offset] === 0) { sStart++; sLen--; }
    const raw = new Uint8Array(64);
    raw.set(sig.slice(rStart, rStart + rLen), 32 - rLen);
    raw.set(sig.slice(sStart, sStart + sLen), 64 - sLen);
    return raw;
  }
  // Unknown format, just take first 64 bytes
  return sig.slice(0, 64);
}

async function signVapidJWT(privateKeyB64, publicKeyRaw, endpoint) {
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: now + 43200,
    sub: 'mailto:push@thingstodo.app'
  }));
  const signingInput = `${header}.${payload}`;
  const pkcs8 = decodePrivateKey(privateKeyB64);
  const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput)));
  const rawSig = toRawSig(sig);
  return `${signingInput}.${base64url(rawSig)}`;
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

async function sendPush(subData, payload, vapidPrivateKey, vapidPublicKey) {
  const sub = JSON.parse(subData);
  const jwt = await signVapidJWT(vapidPrivateKey, vapidPublicKey, sub.endpoint);
  const encrypted = await encryptPayload(payload, sub);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let res;
  try {
    res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`
      },
      body: encrypted,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  return { ok: res.ok, status: res.status, text: await res.text() };
}

export async function onRequest(context) {
  const KV = context.env.PUSH_SCHEDULES;
  let vapidPrivateKey = context.env.VAPID_PRIVATE_KEY;

  // Use hardcoded public key to avoid env var mismatch with private key
  const vapidPublicKey = 'BITp4PXYUt-fqt77OBIt1-T2EWEsd_VR6jSKuj5VF-kUImbyiimU1FrYB0cJHYKbsmUWwAb1fdhf8988kZCuQBc';
  if (!vapidPrivateKey) return new Response('VAPID_PRIVATE_KEY missing', { status: 500 });
  if (!KV) return new Response('KV missing', { status: 500 });

  const list = await KV.list({ prefix: 'sched:' });
  const now = Date.now();
  let sent = 0;
  let errors = [];

  for (const { name } of list.keys) {
    const entry = await KV.get(name);
    if (!entry) continue;
    const data = JSON.parse(entry);
    if (data.remindMs > now) continue;

    const subs = await KV.list({ prefix: 'sub:' });
    for (const { name: subKey } of subs.keys) {
      const subData = await KV.get(subKey);
      if (!subData) continue;
      try {
        const result = await sendPush(subData, {
          title: data.title || 'ThingsToDo',
          body: 'This task is due now.',
          url: `/#goto-task/${data.taskId}`,
          taskId: data.taskId
        }, vapidPrivateKey, vapidPublicKey);
        if (result.ok) {
          sent++;
        } else {
          errors.push(`Push HTTP ${result.status}: ${result.text}`);
        }
      } catch (e) {
        errors.push(`Error: ${e.message}`);
      }
    }
    await KV.delete(name);
  }

  let msg = `Checked ${list.keys.length}, sent ${sent}`;
  if (errors.length) msg += `, errors: ${errors.join(' | ')}`;
  return new Response(msg);
}
