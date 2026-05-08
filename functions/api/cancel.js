export async function onRequest(context) {
  if (context.request.method !== 'POST') return new Response('Not found', { status: 404 });
  const { taskId } = await context.request.json();
  if (!taskId) return new Response('Missing taskId', { status: 400 });
  await context.env.PUSH_SCHEDULES.delete('sched:' + taskId);
  return new Response('OK');
}
