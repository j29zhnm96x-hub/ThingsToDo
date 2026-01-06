import { el, clear } from '../ui/dom.js';
import { renderTodoList } from '../ui/todoList.js';
import { pickProject } from '../ui/pickProject.js';
import { confirm } from '../ui/confirm.js';
import { moveTodo, reorderBucket } from '../logic/todoOps.js';
import { openTodoMenu } from '../ui/todoMenu.js';
import { openTodoInfo } from '../ui/todoInfo.js';
import { openModal } from '../ui/modal.js';
import { newTodo } from '../data/models.js';
import { hapticLight } from '../ui/haptic.js';

async function buildProjectsById(db) {
  const projects = await db.projects.list();
  const map = new Map(projects.map((p) => [p.id, p]));
  return { projects, map };
}

export async function renderProjectDetail(ctx, projectId) {
  const { main, db, modalHost } = ctx;
  clear(main);

  const project = await db.projects.get(projectId);
  if (!project) {
    main.appendChild(el('div', { class: 'card' }, 'Project not found.'));
    return;
  }

  const all = await db.todos.listByProject(projectId);
  const todos = all.filter((t) => !t.archived).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  const { projects, map: projectsById } = await buildProjectsById(db);

  if ((project.type ?? 'default') === 'checklist') {
    const listEl = renderChecklist({ 
      todos, 
      onToggleCompleted: async (todo, checked) => {
        await db.todos.put({
          ...todo,
          completed: checked,
          completedAt: checked ? new Date().toISOString() : null
        });
        await renderProjectDetail(ctx, projectId);
      },
      onDelete: async (todo) => {
        if (todo.protected) {
          openModal(modalHost, {
            title: 'Task Protected',
            content: el('div', {}, 'This task is protected. Please uncheck "Protect task" in the editor to delete it.'),
            actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }]
          });
          return;
        }
        const ok = await confirm(modalHost, {
          title: 'Delete item?',
          message: `Delete "${todo.title}"?`,
          confirmLabel: 'Delete',
          danger: true
        });
        if (!ok) return;
        await db.todos.delete(todo.id);
        await renderProjectDetail(ctx, projectId);
      }
    });

    const hint = el('div', { class: 'checklist__hint' }, 'Double tap to add');
    
    // Exit Focus Mode Button (only visible in focus mode via CSS)
    const exitFocusBtn = el('button', {
      class: 'focus-exit-btn', 
      'aria-label': 'Exit Focus Mode',
      onClick: () => { 
        hapticLight();
        document.body.classList.remove('focus-mode');
      }
    }, '✕'); // simple X icon

    const container = el('div', { class: 'stack' }, listEl, hint, exitFocusBtn);

    main.append(container);

    const triggerAdd = () => quickAddChecklist({ modalHost, db, projectId, onCreated: () => renderProjectDetail(ctx, projectId) });

    // Touch double-tap detection - attach to body for whole screen coverage.
    let lastTap = 0;
    
    document.body.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 350) {
        e.preventDefault();
        triggerAdd();
      }
      lastTap = now;
    }, { passive: false });

    // Mouse/trackpad double-click fallback.
    document.body.addEventListener('dblclick', (e) => { e.preventDefault(); triggerAdd(); });

    return;
  }

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
      await db.todos.put({ 
        ...todo, 
        completed: checked,
        completedAt: checked ? new Date().toISOString() : null
      });
      await renderProjectDetail(ctx, projectId);
    },
    onEdit: (todo) => ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }),
    onMove: async (todo) => {
      const dest = await pickProject(modalHost, { title: 'Move to…', projects, includeInbox: true, initial: todo.projectId ?? null, confirmLabel: 'Move' });
      if (dest === undefined) return;
      await moveTodo(db, todo, dest);
      await renderProjectDetail(ctx, projectId);
    },
    onLinkToggle: async (todo) => {
        // Toggle inbox link
        await db.todos.put({ ...todo, showInInbox: !todo.showInInbox });
        await renderProjectDetail(ctx, projectId);
    },
    onArchive: async (todo) => {
      if (todo.protected) {
        openModal(modalHost, {
          title: 'Task Protected',
          content: el('div', {}, 'This task is protected. Please uncheck "Protect task" in the editor to archive it.'),
          actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }]
        });
        return;
      }
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
      await renderProjectDetail(ctx, projectId);
    },
    onMenu: (todo, { onLinkToggle } = {}) => openTodoMenu(modalHost, {
      title: todo.title || 'Todo',
      actions: [
        { label: 'Edit', class: 'btn', onClick: () => (ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }), true) },
        { label: todo.showInInbox ? 'Unlink from Inbox' : 'Link to Inbox', class: 'btn', onClick: async () => {
             // If onLinkToggle is passed from todoList, use it. Otherwise (if strict) fallback or do nothing.
             // In this context, we know we are in projectDetail, so we could also just define the logic here inline or call the outer onLinkToggle.
             // But using the passed one is cleaner if we rely on todoList to pass everything.
             // Actually, onLinkToggle is defined in the same scope (renderProjectDetail), so we can just use it directly!
             // We don't strictly *need* to pick it from the argument, but for consistency with others, let's assume we use the outer one.
             await onLinkToggle(todo);
             return true;
        } },
        { label: 'Move', class: 'btn', onClick: async () => {
          const dest = await pickProject(modalHost, { title: 'Move to…', projects, includeInbox: true, initial: todo.projectId ?? null, confirmLabel: 'Move' });
          if (dest !== undefined) {
            await moveTodo(db, todo, dest);
            await renderProjectDetail(ctx, projectId);
          }
          return true;
        } },
        { label: 'Archive', class: 'btn btn--danger', onClick: async () => {
          if (todo.protected) {
            openModal(modalHost, {
              title: 'Task Protected',
              content: el('div', {}, 'This task is protected. Please uncheck "Protect task" in the editor to archive it.'),
              actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }]
            });
            return true;
          }
          const ok = await confirm(modalHost, {
            title: 'Archive todo?',
            message: 'You can restore it later from Archive.',
            confirmLabel: 'Archive'
          });
          if (ok) {
            await db.todos.put({
              ...todo,
              archived: true,
              archivedAt: new Date().toISOString(),
              archivedFromProjectId: todo.projectId
            });
            await renderProjectDetail(ctx, projectId);
          }
          return true;
        } }
      ]
    }),
    onReorder: async ({ priority, projectId: containerId, orderedIds }) => {
      await reorderBucket(db, { priority, projectId: containerId, orderedIds });
      await renderProjectDetail(ctx, projectId);
    }
  });

  main.append(el('div', { class: 'stack' }, todos.length ? list : el('div', { class: 'card small' }, 'No todos in this project yet. Tap + to add one.')));
}

function renderChecklist({ todos, onToggleCompleted, onDelete }) {
  const active = todos.filter(t => !t.completed);
  const done = todos.filter(t => t.completed);

  const makeRow = (t, completed) => {
    let pressTimer = null;
    let pressStartTime = 0;
    const LONG_PRESS_DURATION = 1500; // 1.5 seconds

    const textSpan = el('span', { class: 'checklist__text' }, t.title);

    const handlePressStart = (e) => {
      pressStartTime = Date.now();
      pressTimer = setTimeout(() => {
        // Long press detected
        onDelete?.(t);
      }, LONG_PRESS_DURATION);
    };

    const handlePressEnd = (e) => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    textSpan.addEventListener('pointerdown', handlePressStart);
    textSpan.addEventListener('pointerup', handlePressEnd);
    textSpan.addEventListener('pointercancel', handlePressEnd);
    textSpan.addEventListener('pointerleave', handlePressEnd);

    return el('div', {
      class: completed ? 'checklist__item checklist__item--done' : 'checklist__item'
    },
      el('span', { 
        class: completed ? 'checklist__circle checklist__circle--done' : 'checklist__circle',
        onClick: (e) => {
          e.stopPropagation();
          onToggleCompleted?.(t, !completed);
        }
      }, completed ? '✓' : ''),
      textSpan,
      t.protected ? el('span', { class: 'icon-protected', 'aria-label': 'Protected' }, '🔒') : null
    );
  };

  const container = el('div', { class: 'checklist' });
  active.forEach(t => container.appendChild(makeRow(t, false)));
  if (done.length) container.appendChild(el('div', { class: 'todo-divider' }, el('span', { class: 'todo-divider__text' }, 'Completed')));
  done.forEach(t => container.appendChild(makeRow(t, true)));
  return container;
}

function quickAddChecklist({ modalHost, db, projectId, onCreated }) {
  const input = el('input', { class: 'input', placeholder: 'Item name', 'aria-label': 'Item name' });

  const addItem = async () => {
    const title = input.value.trim();
    if (!title) {
      input.focus();
      return false;
    }
    await db.todos.put(newTodo({ title, projectId }));
    onCreated?.();
    return true;
  };

  openModal(modalHost, {
    title: 'Add item',
    content: input,
    align: 'top',
    headerActions: [
      { label: 'Add', class: 'btn btn--primary', onClick: addItem }
    ],
    actions: [
      { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true },
      {
        label: 'Add',
        class: 'btn btn--primary',
        onClick: addItem
      }
    ]
  });

  // Focus immediately (synchronously) to trigger mobile keyboard during the user gesture.
  try { input.focus(); input.select?.(); } catch (e) { /* ignore */ }
}

