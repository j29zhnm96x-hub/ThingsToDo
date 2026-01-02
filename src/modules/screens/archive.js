import { el, clear, emptyState } from '../ui/dom.js';
import { renderTodoList } from '../ui/todoList.js';
import { pickProject } from '../ui/pickProject.js';
import { confirm } from '../ui/confirm.js';
import { restoreTodo } from '../logic/todoOps.js';
import { openTodoMenu } from '../ui/todoMenu.js';
import { openTodoInfo } from '../ui/todoInfo.js';

async function buildProjectsById(db) {
  const projects = await db.projects.list();
  const map = new Map(projects.map((p) => [p.id, p]));
  return { projects, map };
}

export async function renderArchive(ctx) {
  const { main, db, modalHost } = ctx;
  clear(main);

  const archived = await db.todos.listArchived();
  const { projects, map: projectsById } = await buildProjectsById(db);

  const empty = archived.length === 0
    ? emptyState('No archived todos', 'Todos you archive will appear here')
    : null;

  const list = renderTodoList({
    todos: archived,
    projectsById,
    mode: 'archive',
    onTap: (todo) => openTodoInfo({
      todo,
      db,
      modalHost,
      onEdit: () => ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db })
    }),
    onEdit: (todo) => ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }),
    onRestore: async (todo) => {
      // Prompt: restore to Inbox OR selected Project
      const initial = todo.archivedFromProjectId && projectsById.has(todo.archivedFromProjectId)
        ? todo.archivedFromProjectId
        : null;
      const dest = await pickProject(modalHost, {
        title: 'Restore to…',
        projects,
        includeInbox: true,
        initial,
        confirmLabel: 'Restore'
      });
      if (dest === undefined) return;

      await restoreTodo(db, todo, dest);
      await renderArchive(ctx);
    },
    onDelete: async (todo) => {
      const ok = await confirm(modalHost, {
        title: 'Delete archived todo?',
        message: 'This will permanently delete the todo and its images.',
        confirmLabel: 'Delete',
        danger: true
      });
      if (!ok) return;
      await db.todos.delete(todo.id);
      await renderArchive(ctx);
    },
    onMenu: (todo) => openTodoMenu(modalHost, {
      title: todo.title || 'Todo',
      actions: [
        { label: 'Edit', class: 'btn', onClick: () => (ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }), true) },
        { label: 'Restore', class: 'btn', onClick: async () => {
          const initial = todo.archivedFromProjectId && projectsById.has(todo.archivedFromProjectId)
            ? todo.archivedFromProjectId
            : null;
          const dest = await pickProject(modalHost, {
            title: 'Restore to…',
            projects,
            includeInbox: true,
            initial,
            confirmLabel: 'Restore'
          });
          if (dest !== undefined) {
            await restoreTodo(db, todo, dest);
            await renderArchive(ctx);
          }
          return true;
        } },
        { label: 'Delete', class: 'btn btn--danger', onClick: async () => {
          const ok = await confirm(modalHost, {
            title: 'Delete archived todo?',
            message: 'This will permanently delete the todo and its images.',
            confirmLabel: 'Delete',
            danger: true
          });
          if (ok) {
            await db.todos.delete(todo.id);
            await renderArchive(ctx);
          }
          return true;
        } }
      ]
    })
  });

  main.append(el('div', { class: 'stack' }, empty, list));
}
