export async function onRequest(context) {
  if (context.request.method !== 'POST') return new Response('Not found', { status: 404 });
  const { taskId, title, dueDate } = await context.request.json();
  if (!taskId || !dueDate) return new Response('Missing fields', { status: 400 });

  const remindMs = new Date(dueDate).getTime();
  if (remindMs <= Date.now()) return new Response('In the past', { status: 400 });

  const key = 'sched:' + taskId;
  const entry = JSON.stringify({ taskId, title, dueDate, remindMs });

  await context.env.PUSH_SCHEDULES.put(key, entry, { expirationTtl: Math.ceil((remindMs - Date.now()) / 1000) + 86400 });
  return new Response('OK');
}
