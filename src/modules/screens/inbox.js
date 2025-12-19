import { el, clear } from '../ui/dom.js';
import { renderTodoList } from '../ui/todoList.js';
import { pickProject } from '../ui/pickProject.js';
import { confirm } from '../ui/confirm.js';
import { moveTodo } from '../logic/todoOps.js';

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

  const empty = todos.length === 0
    ? el('div', { class: 'card small' }, 'No inbox items. Tap “Add” to capture a todo.')
    : null;

  const list = renderTodoList({
    todos,
    projectsById,
    mode: 'active',
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
    onMoveUp: async (todo) => swapWithNeighbor({ ctx, todo, direction: -1, containerProjectId: null }),
    onMoveDown: async (todo) => swapWithNeighbor({ ctx, todo, direction: 1, containerProjectId: null })
  });

  main.append(el('div', { class: 'stack' }, empty, list));
}

async function swapWithNeighbor({ ctx, todo, direction, containerProjectId }) {
  const { db } = ctx;
  const todos = (await db.todos.listByProject(containerProjectId)).filter((t) => !t.archived && t.priority === todo.priority);
  todos.sort((a, b) => (a.order - b.order) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const idx = todos.findIndex((t) => t.id === todo.id);
  const other = todos[idx + direction];
  if (!other) return;

  const a = await db.todos.get(todo.id);
  const b = await db.todos.get(other.id);
  const tmp = a.order;
  a.order = b.order;
  b.order = tmp;
  await db.todos.put(a);
  await db.todos.put(b);
  await renderInbox(ctx);
}
