import { maxOrderFor } from './sorting.js';
import { compressAttachmentsForArchive } from './attachments.js';
import { createNextRecurringInstance } from './recurrence.js';
import { isDueNowOrPast } from './recurrence.js';

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

async function placeAtEndOfChecklistPage(db, todo, projectId, pageId) {
  const dest = (await db.todos.listByProject(projectId))
    .filter((t) => !t.archived)
    .filter((t) => (t.pageId ?? null) === (pageId ?? null));

  let max = -1;
  for (const t of dest) {
    if (Number.isFinite(t.order)) max = Math.max(max, t.order);
  }

  return {
    ...todo,
    projectId: projectId ?? null,
    pageId: pageId ?? null,
    order: max + 1
  };
}

export async function moveTodo(db, todo, projectId, { pageId = null } = {}) {
  // If a destination pageId is provided, treat the destination as a checklist page move.
  // Otherwise, treat it as a normal project/Inbox move and clear checklist-only fields.
  const updated = pageId != null
    ? await placeAtEndOfChecklistPage(db, { ...todo }, projectId, pageId)
    : await placeAtEndOfBucket(db, { ...todo, pageId: null }, projectId);

  await db.todos.put(updated);
}

export async function restoreTodo(db, todoOrId, projectId) {
  // Fetch fresh data from DB to ensure we have all fields
  const todoId = typeof todoOrId === 'string' ? todoOrId : todoOrId.id;
  const todo = await db.todos.get(todoId);
  if (!todo) return;

  const base = {
    ...todo,
    archived: false,
    archivedAt: null,
    // Reset completion status so the todo is active again
    completed: false,
    completedAt: null
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

/**
 * Auto-archive todos that have been completed for more than 24 hours.
 * Should be called on app startup.
 */
export async function autoArchiveCompleted(db) {
  const allTodos = await db.todos.listActive();
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Build a map of projects that want to keep completed items
  const projects = await db.projects.list();
  const keepCompletedMap = new Map();
  for (const p of projects) {
    if (p.keepCompletedItems) keepCompletedMap.set(p.id, true);
  }

  let archivedCount = 0;
  for (const t of allTodos) {
    if (!t.completed || !t.completedAt) continue;
    
    const completedTime = new Date(t.completedAt).getTime();
    if (isNaN(completedTime)) continue;

    if (now - completedTime > DAY_MS) {
      // Fetch fresh to ensure we have the latest state and all fields
      const todo = await db.todos.get(t.id);
      if (!todo) continue;
      if (todo.archived) continue;
      if (todo.protected) continue; // Skip protected tasks
      if (todo.projectId && keepCompletedMap.has(todo.projectId)) continue; // Skip projects with keepCompletedItems

      await db.todos.put({
        ...todo,
        archived: true,
        archivedAt: new Date().toISOString(),
        archivedFromProjectId: todo.projectId ?? null
      });
      await compressAttachmentsForArchive(db, todo.id);
      archivedCount++;
    }
  }
  
  return archivedCount;
}

/**
 * Move todos to the Bin (soft delete).
 */
export async function recycleTodos(db, todos) {
  const now = new Date().toISOString();
  for (const t of todos) {
    // Store in bin with deletion timestamp
    await db.bin.put({ ...t, deletedAt: now });
    // Remove from active store
    await db.todos.delete(t.id);
  }
}

/**
 * Restore todos from the Bin.
 */
export async function restoreFromBin(db, items) {
  for (const item of items) {
    const { deletedAt, ...todo } = item;
    // Put back into todos store
    await db.todos.put(todo);
    // Remove from bin
    await db.bin.delete(item.id);
  }
}

/**
 * Permanently delete items from Bin that are older than 24 hours.
 */
export async function autoEmptyBin(db) {
  const items = await db.bin.list();
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  
  let count = 0;
  for (const item of items) {
    if (!item.deletedAt) continue;
    const deletedTime = new Date(item.deletedAt).getTime();
    if (now - deletedTime > DAY_MS) {
      await db.bin.delete(item.id);
      count++;
    }
  }
  return count;
}

/**
 * Complete a todo and handle recurring task logic.
 * If the task is recurring, creates the next instance.
 * @param {object} db - Database instance
 * @param {object} todo - The todo being completed
 * @returns {object|null} - The next recurring instance if created, or null
 */
export async function completeTodo(db, todo) {
  // Mark as completed
  const completedTodo = {
    ...todo,
    completed: true,
    completedAt: new Date().toISOString()
  };
  
  await db.todos.put(completedTodo);
  
  // If this is a recurring task, create the next instance
  if (todo.recurrenceType) {
    const nextInstance = await createNextRecurringInstance(completedTodo, db);
    return nextInstance;
  }
  
  return null;
}

/**
 * Uncomplete a todo (toggle back to active).
 * @param {object} db - Database instance
 * @param {object} todo - The todo being uncompleted
 */
export async function uncompleteTodo(db, todo) {
  const activeTodo = {
    ...todo,
    completed: false,
    completedAt: null
  };
  
  await db.todos.put(activeTodo);
}

export async function getAllTodosForProject(projectId, db, projectsById) {
  const todos = await db.todos.listByProject(projectId);
  const nonArchived = todos
    .filter((t) => !t.archived)
    .filter((t) => {
      if (t.isRecurringInstance && t.dueDate && !isDueNowOrPast(t.dueDate)) return false;
      return true;
    });
  const subprojects = Array.from(projectsById.values()).filter(p => p.parentId === projectId);
  for (const sub of subprojects) {
    const subTodos = await getAllTodosForProject(sub.id, db, projectsById);
    nonArchived.push(...subTodos);
  }
  return nonArchived;
}
