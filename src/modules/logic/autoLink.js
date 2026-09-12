// Auto-link projects to the Inbox when they have active (uncompleted) items.
// For projects with autoLinkInbox enabled, showInInbox is fully managed by the app:
// active items exist -> linked; all items completed (or empty) -> unlinked.

import { getAllTodosForProject } from './todoOps.js';

export async function runAutoLinkChecks(db) {
  try {
    const projects = await db.projects.list();
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    for (const p of projects) {
      if (p.autoLinkInbox !== true) continue;
      try {
        const todos = await getAllTodosForProject(p.id, db, projectsById);
        const hasActive = todos.some((t) => !t.completed);
        if (p.showInInbox !== hasActive) {
          await db.projects.put({ ...p, showInInbox: hasActive });
        }
      } catch (e) {
        console.error('Auto-link check failed', p.id, e);
      }
    }
  } catch (e) {
    console.error('runAutoLinkChecks failed', e);
  }
}
