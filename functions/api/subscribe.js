export async function onRequest(context) {
  if (context.request.method !== 'POST') return new Response('Not found', { status: 404 });
  const { subscription } = await context.request.json();
  if (!subscription?.endpoint) return new Response('Missing subscription', { status: 400 });
  const key = 'sub:' + sha256(subscription.endpoint).slice(0, 16);
  await context.env.PUSH_SCHEDULES.put(key, JSON.stringify(subscription));
  return new Response('OK');
}

function sha256(str) {
  return [...new Uint8Array(new TextEncoder().encode(str))].map(b => b.toString(16).padStart(2, '0')).join('');
}
