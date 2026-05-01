import { el, clear, emptyState } from '../ui/dom.js';
import { renderTodoList } from '../ui/todoList.js';
import { pickProject } from '../ui/pickProject.js';
import { confirm } from '../ui/confirm.js';
import { moveTodo, reorderBucket, completeTodo, uncompleteTodo, getAllTodosForProject } from '../logic/todoOps.js';
import { compressAttachmentsForArchive } from '../logic/attachments.js';
import { openTodoMenu } from '../ui/todoMenu.js';
import { openTodoInfo } from '../ui/todoInfo.js';
import { renderProjectCard } from '../ui/projectCard.js';
import { openProjectMenu } from '../ui/projectMenu.js';
import { hapticLight } from '../ui/haptic.js';
import { Priority } from '../data/models.js';
import { t } from '../utils/i18n.js';
import { renderVoiceMemoList, openPlaybackModal, openVoiceMemoMenu } from '../ui/voiceMemo.js';
import { openModal } from '../ui/modal.js';
import { isDueNowOrPast } from '../logic/recurrence.js';

async function buildProjectsById(db) {
  const projects = await db.projects.list();
  const map = new Map(projects.map((p) => [p.id, p]));
  return { projects, map };
}

export async function renderInbox(ctx) {
  const { main, db, modalHost } = ctx;
  clear(main);

  // Clear any existing group timers created by prior renders
  if (renderInbox._groupTimers) {
    for (const t of renderInbox._groupTimers) clearInterval(t);
  }
  renderInbox._groupTimers = [];

  const allTodos = await db.todos.listActive();
  // Filter for inbox items and exclude future recurring instances
  const todos = allTodos.filter(t => {
    // Include if it's inbox or linked to inbox
    if (!(t.projectId === null || t.showInInbox === true)) {
      // Check if it's a task with due date approaching (3 days before)
      if (t.dueDate && t.projectId !== null) {
        const dueTime = new Date(t.dueDate).getTime();
        const now = Date.now();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        if (now >= dueTime - threeDaysMs) {
          // Include as virtual link
          t.isVirtualLink = true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
    // Exclude future recurring instances (not yet due)
    if (t.isRecurringInstance && t.dueDate && !isDueNowOrPast(t.dueDate)) return false;
    return true;
  });
  const { projects, map: projectsById } = await buildProjectsById(db);
  const settings = await db.settings.get();
  const groupedLevels = (settings?.taskGrouping?.groupedLevels || []).slice();

  // Projects linked to Inbox
  const linkedProjects = projects.filter((p) => p.showInInbox);
  const linkedProjectStats = new Map();
  for (const p of linkedProjects) {
    const allTodos = await getAllTodosForProject(p.id, db, projectsById);
    const nonArchived = allTodos
      .filter((t) => !t.archived)
      .filter((t) => {
        // Exclude future recurring instances
        if (t.isRecurringInstance && t.dueDate && !isDueNowOrPast(t.dueDate)) return false;
        return true;
      });
    const total = nonArchived.length;
    const completed = nonArchived.filter((t) => t.completed).length;
    const active = total - completed;
    linkedProjectStats.set(p.id, { total, completed, active });
  }

  // Voice memos in inbox
  const voiceMemos = await db.voiceMemos.listForInbox();

  // If grouping is enabled (levels selected), create grouped cards for those priorities first
  let list = null;
  if (groupedLevels && groupedLevels.length) {
    // Build grouped section manually, then append remaining todos via renderTodoList
    const container = el('div', { class: 'list' });

    // Helper to render a grouped card for a priority
    const renderGroupCard = (priority, items) => {
      let idx = 0;
      const card = el('div', { class: 'todo todo--group', 'data-priority': priority },
        el('div', { class: 'todo__row1' },
          el('div', { class: 'todo__checkWrap' }, el('div', { style: { width: '12px' } })),
          el('div', { class: 'todo__titleArea' }, el('div', { class: 'todo__title' }, items[0]?.title || '')),
          el('div', { class: 'todo__icons' }, el('button', { class: 'todo__menuBtn', onClick: (e) => { e.stopPropagation(); openTodoMenu(modalHost, { title: 'Group', actions: [{ label: 'Expand', class: 'btn', onClick: () => expand() }, { label: 'Close', class: 'btn btn--ghost', onClick: () => true }] }); } }, '⋯'))
        )
      );

      const titleArea = card.querySelector('.todo__title');

      // Cycling
      const cycle = () => {
        idx = (idx + 1) % items.length;
        titleArea.textContent = items[idx].title;
        // Auto-scroll if overflow
        setTimeout(() => {
          if (titleArea.scrollWidth > titleArea.clientWidth) {
            titleArea.style.transition = 'transform 6s linear';
            titleArea.style.transform = `translateX(-${titleArea.scrollWidth - titleArea.clientWidth}px)`;
            setTimeout(() => { titleArea.style.transition = ''; titleArea.style.transform = ''; }, 6000);
          }
        }, 50);
      };

      if (items.length > 1) {
        const timer = setInterval(cycle, 2500);
        renderInbox._groupTimers.push(timer);
      }

      const expand = () => {
        // Replace card content with expanded list of tasks
        const expanded = el('div', { class: 'card stack' }, ...items.map((it) => {
          const color = (it.priority === Priority.URGENT) ? 'var(--pUrgent)' : (it.priority === 'P0' ? 'var(--p0)' : (it.priority === 'P1' ? 'var(--p1)' : (it.priority === 'P2' ? 'var(--p2)' : 'var(--p3)')));
          const cb = el('input', { type: 'checkbox', checked: it.completed ? 'checked' : null, onChange: async (e) => {
            if (e.target.checked) await completeTodo(db, { ...it, priority: Priority.P3 }); else await uncompleteTodo(db, it);
            await renderInbox(ctx);
          } });
          return el('div', { class: 'row', style: { alignItems: 'center', gap: '8px' } },
            cb,
            el('span', { style: { width: '12px', height: '12px', borderRadius: '50%', background: color, display: 'inline-block' } }),
            el('span', {}, it.title)
          );
        }));
        openModal(modalHost, { title: t('group') || 'Group', content: expanded, actions: [{ label: t('close') || 'Close', class: 'btn btn--primary', onClick: () => true }] });
      };

      card.addEventListener('click', (e) => {
        e.stopPropagation();
        expand();
      });

      return card;
    };

    // Clone todos array to mutate
    const todosCopy = todos.slice();
    for (const lvl of groupedLevels) {
      const groupItems = todosCopy.filter(t => t.priority === lvl);
      if (groupItems.length === 0) continue;
      // Remove from todosCopy
      for (const it of groupItems) {
        const i = todosCopy.indexOf(it);
        if (i !== -1) todosCopy.splice(i, 1);
      }
      container.appendChild(renderGroupCard(lvl, groupItems));
    }

    // Render remaining todos using the normal list renderer
    list = container;
    if (todosCopy.length) {
      list.appendChild(renderTodoList({
        todos: todosCopy,
        projectsById,
        mode: 'active',
        onTap: (todo) => {
          if (todo.projectId && (todo.showInInbox || todo.isVirtualLink)) { location.hash = '#project/' + todo.projectId; return; }
          openTodoInfo({ todo, db, modalHost, onEdit: () => ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }) });
        },
        onToggleCompleted: async (todo, checked) => {
          if (checked) { await completeTodo(db, { ...todo, priority: Priority.P3 }); } else { await uncompleteTodo(db, todo); }
          await renderInbox(ctx);
        },
        onEdit: (todo) => { if (todo.isVirtualLink) return; ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }); },
        onMove: async (todo) => { const dest = await pickProject(modalHost, { title: 'Move to…', projects, includeInbox: true, initial: todo.projectId ?? null, confirmLabel: 'Move' }); if (dest === undefined) return; await moveTodo(db, todo, dest); await renderInbox(ctx); },
        onLinkToggle: async (todo) => { await db.todos.put({ ...todo, showInInbox: !todo.showInInbox }); await renderInbox(ctx); },
        onArchive: async (todo) => { if (todo.protected) { openModal(modalHost, { title: 'Task Protected', content: el('div', {}, 'This task is protected.'), actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }] }); return; } const ok = await confirm(modalHost, { title: 'Archive todo?', message: 'You can restore it later from Archive.', confirmLabel: 'Archive' }); if (!ok) return; await db.todos.put({ ...todo, archived: true, archivedAt: new Date().toISOString(), archivedFromProjectId: todo.projectId, priority: Priority.P3 }); await compressAttachmentsForArchive(db, todo.id); await renderInbox(ctx); },
        onMenu: (todo, opts) => openTodoMenu(modalHost, { title: todo.title || 'Todo', actions: [ { label: 'Edit', class: 'btn', onClick: () => (ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }), true) }, { label: 'Share…', class: 'btn', onClick: async () => { const { exportTodoToFile } = await import('../utils/share.js'); await exportTodoToFile(db, todo); return true; } }, { label: 'Move', class: 'btn', onClick: async () => { const dest = await pickProject(modalHost, { title: 'Move to…', projects, includeInbox: true, initial: todo.projectId ?? null, confirmLabel: 'Move' }); if (dest === undefined) return false; await moveTodo(db, todo, dest); await renderInbox(ctx); return true; } }, { label: 'Archive', class: 'btn btn--danger', onClick: async () => { const ok = await confirm(modalHost, { title: 'Archive todo?', message: 'You can restore it later from Archive.', confirmLabel: 'Archive' }); if (ok) { await db.todos.put({ ...todo, archived: true, archivedAt: new Date().toISOString(), archivedFromProjectId: todo.projectId }); await compressAttachmentsForArchive(db, todo.id); await renderInbox(ctx); } return true; } } ] }),
        onReorder: async ({ priority, projectId: containerId, orderedIds }) => { await reorderBucket(db, { priority, projectId: containerId, orderedIds }); await renderInbox(ctx); }
      }));
    }
  } else {
    list = renderTodoList({
    todos,
    projectsById,
    mode: 'active',
    onTap: (todo) => {
      // If linked card (has project but shown here), navigate to project
      if (todo.projectId && (todo.showInInbox || todo.isVirtualLink)) {
         location.hash = '#project/' + todo.projectId;
         return;
      }
      openTodoInfo({
        todo,
        db,
        modalHost,
        onEdit: () => ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db })
      });
    },
    onToggleCompleted: async (todo, checked) => {
      if (checked) {
        // Use completeTodo for proper recurring task handling
        await completeTodo(db, { ...todo, priority: Priority.P3 });
      } else {
        await uncompleteTodo(db, todo);
      }
      await renderInbox(ctx);
    },
    onEdit: (todo) => {
      if (todo.isVirtualLink) return; // No edit for virtual links
      ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db });
    },
    onMove: async (todo) => {
      const dest = await pickProject(modalHost, { title: 'Move to…', projects, includeInbox: true, initial: todo.projectId ?? null, confirmLabel: 'Move' });
      if (dest === undefined) return;
      await moveTodo(db, todo, dest);
      await renderInbox(ctx);
    },
    onLinkToggle: async (todo) => {
        // Toggle inbox link
        await db.todos.put({ ...todo, showInInbox: !todo.showInInbox });
        await renderInbox(ctx);
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
      await renderInbox(ctx);
    },
    onMenu: (todo, { onLinkToggle } = {}) => openTodoMenu(modalHost, {
      title: todo.title || 'Todo',
      actions: [
        { label: 'Edit', class: 'btn', onClick: () => (ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }), true) },
        // Only show Unlink for Project tasks that are here via link
        ...(todo.projectId && todo.showInInbox ? [{
          label: 'Unlink from Inbox', 
          class: 'btn', 
          onClick: async () => {
             if (onLinkToggle) await onLinkToggle(todo);
             else {
                 await db.todos.put({ ...todo, showInInbox: !todo.showInInbox });
                 await renderInbox(ctx);
             }
             return true;
          }
        }] : []),
        { label: 'Share…', class: 'btn', onClick: async () => { const { exportTodoToFile } = await import('../utils/share.js'); await exportTodoToFile(db, todo); return true; } },
        { label: 'Move', class: 'btn', onClick: async () => {
          const dest = await pickProject(modalHost, { title: 'Move to…', projects, includeInbox: true, initial: todo.projectId ?? null, confirmLabel: 'Move' });
          if (dest === undefined) return false;
          await moveTodo(db, todo, dest);
          await renderInbox(ctx);
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
          if (!ok) return false;
          await db.todos.put({
            ...todo,
            archived: true,
            archivedAt: new Date().toISOString(),
            archivedFromProjectId: todo.projectId
          });
          await compressAttachmentsForArchive(db, todo.id);
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
  }
  const linkedProjectsList = linkedProjects.length
    ? el('div', { class: 'list' },
        ...linkedProjects.map((p) => renderProjectCard({
          project: p,
          stats: linkedProjectStats.get(p.id) || { total: 0, completed: 0, active: 0 },
          onOpen: () => {
            hapticLight();
            location.hash = `#project/${p.id}`;
          },
          onMenu: () => {
            hapticLight();
            openProjectMenu(modalHost, { db, project: p, onChange: () => renderInbox(ctx) });
          }
        }))
      )
    : null;

  // Voice memos section
  const voiceMemosList = voiceMemos.length
    ? el('div', { style: 'margin-top: 16px;' },
        el('div', { style: 'font-size: 0.8125rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; padding: 0 4px;' }, t('voiceMemos')),
        renderVoiceMemoList({
          memos: voiceMemos,
          modalHost,
          db,
          projects,
          onChange: () => renderInbox(ctx)
        })
      )
    : null;

  if (todos.length === 0 && linkedProjects.length === 0 && voiceMemos.length === 0) {
    main.append(emptyState(t('noTasks'), t('noTasksHint')));
  } else {
    main.append(el('div', { class: 'stack' }, linkedProjectsList, voiceMemosList, todos.length ? list : null));
  }
}
