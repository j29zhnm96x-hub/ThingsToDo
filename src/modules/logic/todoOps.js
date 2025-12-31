import { maxOrderFor } from './sorting.js';

// Shared operations that must keep ordering rules consistent.
// Default sorting:
// 1) priority (P0 -> P3)
// 2) manual order within same priority
// 3) createdAt fallback

async function placeAtEndOfBucket(db, todo, projectId) {
  const dest = (await db.todos.listByProject(projectId)).filter((t) => !t.archived);
  const max = maxOrderFor(dest, { priority: todo.priority });
  return { ...todo, projectId: projectId ?? null, order: (Number.isFinite(max) ? max : -1) + 1 };
}

export async function moveTodo(db, todo, projectId) {
  const updated = await placeAtEndOfBucket(db, todo, projectId);
  await db.todos.put(updated);
}

export async function restoreTodo(db, todo, projectId) {
  const base = {
    ...todo,
    archived: false,
    archivedAt: null
  };
  const updated = await placeAtEndOfBucket(db, base, projectId);
  await db.todos.put(updated);
}

export async function reorderBucket(db, { projectId, priority, orderedIds }) {
  // Update `order` sequentially for the given bucket.
  // Caller should pass only active todos from the same projectId + priority.
  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i];
    const existing = await db.todos.get(id);
    if (!existing) continue;
    if ((existing.projectId ?? null) !== (projectId ?? null)) continue;
    if (existing.priority !== priority) continue;
    if (existing.order === i) continue;
    await db.todos.put({ ...existing, order: i });
  }
}
