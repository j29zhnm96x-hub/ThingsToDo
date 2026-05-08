export async function onRequest(context) {
  const KV = context.env.PUSH_SCHEDULES;
  if (!KV) return new Response('KV missing', { status: 500 });

  // Keep only the user's real subscription (the one with HTTP 201 success)
  // Remove dummy test subscriptions
  const subs = await KV.list({ prefix: 'sub:' });
  let removed = 0;
  for (const { name } of subs.keys) {
    const data = await KV.get(name);
    if (!data) continue;
    try {
      const sub = JSON.parse(data);
      // Check if it's a dummy/test subscription
      if (sub.endpoint.includes('test') || sub.endpoint.includes('dummy') || sub.endpoint.includes('example')) {
        await KV.delete(name);
        removed++;
      }
    } catch { await KV.delete(name); removed++; }
  }
  return new Response(`Cleaned up ${removed} test subscriptions.`);
}
