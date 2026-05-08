export async function onRequest(context) {
  try {
    if (context.request.method !== 'POST') {
      return new Response('Not found', { status: 404 });
    }
    const { subscription } = await context.request.json();
    if (!subscription?.endpoint) {
      return new Response('Missing subscription', { status: 400 });
    }
    const key = 'sub:' + hash(subscription.endpoint).slice(0, 16);
    await context.env.PUSH_SCHEDULES.put(key, JSON.stringify(subscription));
    return new Response('OK');
  } catch (err) {
    return new Response('Error: ' + err.message, { status: 500 });
  }
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16);
}
