// Same functions as check.js
function fromBase64url(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return Uint8Array.from(atob(str), c => c.charCodeAt(0)); }
function base64url(d) { if (typeof d !== 'string') { let s=''; for(let i=0;i<d.length;i++) s+=String.fromCharCode(d[i]); d=s; } return btoa(d).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function decodePrivateKey(keyStr) {
  try { const raw = fromBase64url(keyStr); if (raw.length > 10 && raw[0] === 0x30) return raw; } catch {}
  try { const pem = new TextDecoder().decode(fromBase64url(keyStr)); const b64 = pem.replace(/-----BEGIN [\w ]+-----/, '').replace(/-----END [\w ]+-----/, '').replace(/\s/g, ''); return fromBase64url(b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')); } catch {}
  try { const b64 = keyStr.replace(/-----BEGIN [\w ]+-----/, '').replace(/-----END [\w ]+-----/, '').replace(/\s/g, ''); return fromBase64url(b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')); } catch {}
  throw new Error('Invalid PKCS8 input');
}
function toRawSig(sig) {
  if (sig.length === 64) return sig;
  if (sig.length > 64 && sig[0] === 0x30) {
    let offset = 1; if (sig[offset] & 0x80) offset += (sig[offset] & 0x7f) + 1; else offset++;
    if (sig[offset++] !== 0x02) return sig.slice(0, 64);
    let rLen = sig[offset++], rStart = offset; if (rLen === 33 && sig[offset] === 0) { rStart++; rLen--; }
    offset += (rLen === 33 ? 33 : rLen);
    if (sig[offset++] !== 0x02) return sig.slice(0, 64);
    let sLen = sig[offset++], sStart = offset; if (sLen === 33 && sig[offset] === 0) { sStart++; sLen--; }
    const raw = new Uint8Array(64); raw.set(sig.slice(rStart, rStart + rLen), 32 - rLen); raw.set(sig.slice(sStart, sStart + sLen), 64 - sLen);
    return raw;
  }
  return sig.slice(0, 64);
}
async function signVapidJWT(privateKeyB64, endpoint) {
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = base64url(JSON.stringify({ aud: new URL(endpoint).origin, exp: now + 43200, sub: 'mailto:push@thingstodo.app' }));
  const signingInput = `${header}.${payload}`;
  const pkcs8 = decodePrivateKey(privateKeyB64);
  const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput)));
  return `${signingInput}.${base64url(toRawSig(sig))}`;
}

export async function onRequest(context) {
  try {
    const KV = context.env.PUSH_SCHEDULES;
    const privKey = context.env.VAPID_PRIVATE_KEY;
    const pubKey = 'BITp4PXYUt-fqt77OBIt1-T2EWEsd_VR6jSKuj5VF-kUImbyiimU1FrYB0cJHYKbsmUWwAb1fdhf8988kZCuQBc';

    if (!KV) return new Response('KV binding missing');
    if (!privKey) return new Response('VAPID_PRIVATE_KEY missing');

    const subs = await KV.list({ prefix: 'sub:' });
    if (subs.keys.length === 0) return new Response('No subscriptions.');

    let results = [];
    for (const { name } of subs.keys) {
      const subData = await KV.get(name);
      if (!subData) continue;
      const sub = JSON.parse(subData);
      try {
        const jwt = await signVapidJWT(privKey, sub.endpoint);
        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: {
            'Content-Length': '0',
            TTL: '86400',
            Authorization: `vapid t=${jwt}, k=${pubKey}`
          }
        });
        const txt = await res.text();
        results.push(`[${name}] HTTP ${res.status}: ${txt.slice(0, 100)}`);
      } catch (e) {
        results.push(`[${name}] ERROR: ${e.message}`);
      }
    }
    return new Response(results.join('\n'));
  } catch (err) {
    return new Response('FATAL: ' + err.message + '\n' + (err.stack || ''), { status: 500 });
  }
}
