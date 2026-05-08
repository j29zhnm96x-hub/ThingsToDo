export async function onRequest(context) {
  const KV = context.env.PUSH_SCHEDULES;
  if (!KV) return new Response('KV missing', { status: 500 });

  const subs = await KV.list({ prefix: 'sub:' });
  let removed = 0;
  let kept = 0;
  for (const { name } of subs.keys) {
    if (name === 'sub:31405068') {
      kept++;
    } else {
      await KV.delete(name);
      removed++;
    }
  }
  return new Response(`Removed ${removed}, kept ${kept} subscriptions.`);
}
