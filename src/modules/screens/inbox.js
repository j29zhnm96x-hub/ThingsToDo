import { el, clear } from '../ui/dom.js';
import { renderTodoList } from '../ui/todoList.js';
import { pickProject } from '../ui/pickProject.js';
import { confirm } from '../ui/confirm.js';
import { moveTodo, reorderBucket } from '../logic/todoOps.js';
import { openTodoMenu } from '../ui/todoMenu.js';
import { openTodoInfo } from '../ui/todoInfo.js';

async function buildProjectsById(db) {
  const projects = await db.projects.list();
  const map = new Map(projects.map((p) => [p.id, p]));
  return { projects, map };
}

export async function renderInbox(ctx) {
  const { main, db, modalHost } = ctx;
  clear(main);

  const todos = (await db.todos.listByProject(null)).filter((t) => !t.archived);
  const { projects, map: projectsById } = await buildProjectsById(db);

  const list = renderTodoList({
    todos,
    projectsById,
    mode: 'active',
    onTap: (todo) => openTodoInfo({
      todo,
      db,
      modalHost,
      onEdit: () => ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db })
    }),
    onToggleCompleted: async (todo, checked) => {
      await db.todos.put({ ...todo, completed: checked });
      await renderInbox(ctx);
    },
    onEdit: (todo) => ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }),
    onMove: async (todo) => {
      const dest = await pickProject(modalHost, { title: 'Move to…', projects, includeInbox: true, initial: todo.projectId ?? null, confirmLabel: 'Move' });
      if (dest === undefined) return;
      await moveTodo(db, todo, dest);
      await renderInbox(ctx);
    },
    onArchive: async (todo) => {
      const ok = await confirm(modalHost, {
        title: 'Archive todo?',
        message: 'You can restore it later from Archive.',
        confirmLabel: 'Archive'
      });
      if (!ok) return;
      await db.todos.put({
        ...todo,
        archived: true,
        archivedAt: new Date().toISOString(),
        archivedFromProjectId: todo.projectId
      });
      await renderInbox(ctx);
    },
    onMenu: (todo) => openTodoMenu(modalHost, {
      title: todo.title || 'Todo',
      actions: [
        { label: 'Edit', class: 'btn', onClick: () => (ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }), true) },
        { label: 'Move', class: 'btn', onClick: async () => {
          const dest = await pickProject(modalHost, { title: 'Move to…', projects, includeInbox: true, initial: todo.projectId ?? null, confirmLabel: 'Move' });
          if (dest === undefined) return false;
          await moveTodo(db, todo, dest);
          await renderInbox(ctx);
          return true;
        } },
        { label: 'Archive', class: 'btn btn--danger', onClick: async () => {
          const ok = await confirm(modalHost, {
            title: 'Archive todo?',
            message: 'You can restore it later from Archive.',
            confirmLabel: 'Archive'
          });
          if (!ok) return false;
          await db.todos.put({
            ...todo,
            archived: true,
            archivedAt: new Date().toISOString(),
            archivedFromProjectId: todo.projectId
          });
          await renderInbox(ctx);
          return true;
        } }
      ]
    }),
    onReorder: async ({ priority, projectId, orderedIds }) => {
      await reorderBucket(db, { priority, projectId, orderedIds });
      await renderInbox(ctx);
    }
  });

  main.append(el('div', { class: 'stack' }, list));
}
