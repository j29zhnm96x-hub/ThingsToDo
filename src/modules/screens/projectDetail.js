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
import { openCreateProject } from './projects.js';
import { openProjectMenu } from '../ui/projectMenu.js';
import { renderProjectCard } from '../ui/projectCard.js';
import { Priority } from '../data/models.js';

import { compressAttachmentsForArchive } from '../logic/attachments.js';
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

  // Fetch sub-projects
  const allProjects = await db.projects.list();
  const subProjects = allProjects
    .filter(p => p.parentId === projectId)
    .sort((a, b) => {
      if (typeof a.sortOrder === 'number' && typeof b.sortOrder === 'number') return a.sortOrder - b.sortOrder;
      if (a.sortOrder < b.sortOrder) return -1;
      if (a.sortOrder > b.sortOrder) return 1;
      return 0;
    });
  
  // Calculate sub-project stats
  const subProjectStats = new Map();
  for (const p of subProjects) {
  await compressAttachmentsForArchive(db, todo.id);
      const pTodos = await db.todos.listByProject(p.id);
      const nonArchived = pTodos.filter((t) => !t.archived);
      const total = nonArchived.length;
      const completed = nonArchived.filter(t => t.completed).length;
      const active = total - completed;
      subProjectStats.set(p.id, { total, completed, active });
  }

  // Render Sub-projects section
  let subProjectsList = null;
  if (subProjects.length > 0) {
      subProjectsList = el('div', { class: 'list', style: { marginBottom: '16px' } });
      
      subProjects.forEach(p => {
          const stats = subProjectStats.get(p.id);

          const card = renderProjectCard({
            project: p,
            stats,
            onOpen: () => {
              hapticLight();
              location.hash = `#project/${p.id}`;
            },
            onMenu: () => {
              hapticLight();
              openProjectMenu(modalHost, { db, project: p, onChange: () => renderProjectDetail(ctx, projectId) });
            }
          });

          subProjectsList.appendChild(card);
      });

      // Enable drag reordering for sub-projects (sibling order)
      let pointerId = null;
      let dragged = null;
      let placeholder = null;
      let started = false;
      let startY = 0;
      let offsetY = 0;
      let rect = null;
      let prevTouchAction = '';
      let downTime = 0;
      let scrollBaseline = 0;
      let ignoreClick = false;
      const threshold = 6;
      const appEl = typeof document !== 'undefined' ? document.getElementById('app') : null;

      const isInteractive = (node) => !!node.closest('button, input, a, select, textarea') || !!node.closest('.projectCard__menuBtn');
      const cardFromEvent = (e) => e.target.closest('.projectCard');

      function cleanup() {
        if (dragged) {
          dragged.classList.remove('todo--dragging');
          dragged.style.width = '';
          dragged.style.left = '';
          dragged.style.top = '';
        }
        if (placeholder) placeholder.remove();
        document.body.classList.remove('dragging-reorder');
        subProjectsList.style.touchAction = prevTouchAction;
        pointerId = null;
        dragged = null;
        placeholder = null;
        started = false;
        rect = null;
        setTimeout(() => { ignoreClick = false; }, 100);
      }

      subProjectsList.addEventListener('pointerdown', (e) => {
        if (pointerId != null) return;
        const card = cardFromEvent(e);
        if (!card) return;
        if (isInteractive(e.target)) return;

        pointerId = e.pointerId;
        dragged = card;
        startY = e.clientY;
        rect = dragged.getBoundingClientRect();
        offsetY = e.clientY - rect.top;
        downTime = Date.now();
        scrollBaseline = appEl ? appEl.scrollTop : (document.scrollingElement?.scrollTop || 0);
      });

      subProjectsList.addEventListener('pointermove', (e) => {
        if (pointerId == null || e.pointerId !== pointerId || !dragged) return;

        const dy = e.clientY - startY;
        if (!started && Math.abs(dy) < threshold) return;

        if (!started) {
          const currentScroll = appEl ? appEl.scrollTop : (document.scrollingElement?.scrollTop || 0);
          if (currentScroll !== scrollBaseline) return;
          const HOLD_MS = 120;
          if (Date.now() - downTime < HOLD_MS) return;

          started = true;
          ignoreClick = true;
          prevTouchAction = subProjectsList.style.touchAction || '';
          subProjectsList.style.touchAction = 'none';
          document.body.classList.add('dragging-reorder');
          try { dragged.setPointerCapture(pointerId); } catch { /* ignore */ }

          placeholder = el('div', { class: 'projectCard todo--placeholder' });
          placeholder.style.height = `${rect.height}px`;
          dragged.parentNode.insertBefore(placeholder, dragged.nextSibling);

          dragged.classList.add('todo--dragging');
          dragged.style.width = `${rect.width}px`;
          dragged.style.left = `${rect.left}px`;
          dragged.style.top = `${rect.top}px`;
        }

        e.preventDefault();
        dragged.style.top = `${e.clientY - offsetY}px`;

        const group = Array.from(subProjectsList.querySelectorAll('.projectCard')).filter((n) => n !== dragged && n !== placeholder);
        if (!group.length) return;

        const y = e.clientY;
        let inserted = false;
        for (const card of group) {
          const r = card.getBoundingClientRect();
          const mid = r.top + r.height / 2;
          if (y < mid) {
            if (placeholder !== card.previousSibling) {
              subProjectsList.insertBefore(placeholder, card);
            }
            inserted = true;
            break;
          }
        }
        if (!inserted) {
          const last = group[group.length - 1];
          if (last && last.nextSibling !== placeholder) {
            subProjectsList.insertBefore(placeholder, last.nextSibling);
          }
        }
      }, { passive: false });

      subProjectsList.addEventListener('pointerup', async (e) => {
        if (pointerId == null || e.pointerId !== pointerId || !dragged) return;
        try { dragged.releasePointerCapture(pointerId); } catch { /* ignore */ }

        const wasStarted = started;
        if (started && placeholder) {
          hapticLight();
          subProjectsList.insertBefore(dragged, placeholder);
        }

        cleanup();

        if (wasStarted) {
          const newOrder = Array.from(subProjectsList.querySelectorAll('.projectCard[data-project-id]')).map((n) => n.dataset.projectId);
          for (let i = 0; i < newOrder.length; i++) {
            const pid = newOrder[i];
            const sp = subProjects.find((x) => x.id === pid);
            if (sp && sp.sortOrder !== i) {
              sp.sortOrder = i;
              await db.projects.put(sp);
            }
          }
        }
      });

      subProjectsList.addEventListener('pointercancel', () => {
        if (started && placeholder && dragged) subProjectsList.insertBefore(dragged, placeholder);
        cleanup();
      });
  }

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
    
    // Exit button in Focus Mode now uses the header toggle, no extra button needed on screen.

    const container = el('div', { class: 'stack' }, 
       subProjectsList, // Add sub-projects list at the top (if any)
       listEl, 
       hint
    );

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
        completedAt: checked ? new Date().toISOString() : null,
        priority: checked ? Priority.P3 : todo.priority
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
        archivedFromProjectId: todo.projectId,
        priority: Priority.P3
      });
      await compressAttachmentsForArchive(db, todo.id);
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
            await compressAttachmentsForArchive(db, todo.id);
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

  main.append(el('div', { class: 'stack' }, 
      subProjectsList, // Add sub-projects list at the top
      todos.length ? list : el('div', { class: 'card small' }, 'No todos in this project yet. Tap + to add one.')
  ));
}

// New function to handle the "+" menu
export function openProjectAddMenu(ctx, project) {
    const { modalHost, db } = ctx;
    
    // Bottom sheet style
    openModal(modalHost, {
        title: 'Add to Project',
        align: 'bottom',
        content: el('div', { class: 'stack' }, 
            el('button', { 
                class: 'btn btn--primary',
                style: { justifyContent: 'flex-start', padding: '16px' }, 
                onClick: () => {
                   ctx.openTodoEditor({ mode: 'create', projectId: project.id });
                   return true; // close modal
                }
            }, '📄 New Task'),
             el('button', { 
                class: 'btn', 
                style: { justifyContent: 'flex-start', padding: '16px' }, 
                onClick: () => {
                   // Open Create Project with parentId preset
                   openCreateProject({ 
                       db, 
                       modalHost, 
                       parentId: project.id,
                       onCreated: () => renderProjectDetail(ctx, project.id)
                   });
                   return true; // close modal
                }
            }, '📁 New Sub-Project')
        ),
        actions: [
            { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true }
        ]
    });
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
