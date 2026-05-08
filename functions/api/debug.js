export async function onRequest(context) {
  const KV = context.env.PUSH_SCHEDULES;
  if (!KV) return new Response('KV not available', { status: 500 });

  const subs = await KV.list({ prefix: 'sub:' });
  const sched = await KV.list({ prefix: 'sched:' });

  let out = `KV status:
Subscriptions: ${subs.keys.length}
Scheduled: ${sched.keys.length}

Subscription keys:
`;
  for (const { name } of subs.keys) {
    out += `  - ${name}\n`;
  }
  out += '\nScheduled keys:\n';
  for (const { name } of sched.keys) {
    const entry = await KV.get(name);
    out += `  - ${name}: ${entry}\n`;
  }
  return new Response(out);
}
