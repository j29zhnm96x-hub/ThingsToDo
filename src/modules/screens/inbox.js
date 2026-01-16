import { el, clear, emptyState } from '../ui/dom.js';
import { renderTodoList } from '../ui/todoList.js';
import { pickProject } from '../ui/pickProject.js';
import { confirm } from '../ui/confirm.js';
import { moveTodo, reorderBucket, completeTodo, uncompleteTodo } from '../logic/todoOps.js';
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

  const allTodos = await db.todos.listActive();
  // Filter for inbox items and exclude future recurring instances
  const todos = allTodos.filter(t => {
    // Include if it's inbox or linked to inbox
    if (!(t.projectId === null || t.showInInbox === true)) return false;
    // Exclude future recurring instances (not yet due)
    if (t.isRecurringInstance && t.dueDate && !isDueNowOrPast(t.dueDate)) return false;
    return true;
  });
  const { projects, map: projectsById } = await buildProjectsById(db);

  // Projects linked to Inbox
  const linkedProjects = projects.filter((p) => p.showInInbox);
  const linkedProjectStats = new Map();
  for (const p of linkedProjects) {
    const pTodos = await db.todos.listByProject(p.id);
    // Filter out archived and future recurring instances (same as display logic)
    const nonArchived = pTodos
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

  const list = renderTodoList({
    todos,
    projectsById,
    mode: 'active',
    onTap: (todo) => {
      // If linked card (has project but shown here), navigate to project
      if (todo.projectId && todo.showInInbox) {
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
    onEdit: (todo) => ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }),
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
             // Use the passed onLinkToggle or the one in scope (they are effectively the same logic but let's use the passed one for correctness)
             if (onLinkToggle) await onLinkToggle(todo);
             else {
                 // Fallback if not passed (though it should be)
                 await db.todos.put({ ...todo, showInInbox: !todo.showInInbox });
                 await renderInbox(ctx);
             }
             return true;
          }
        }] : []),
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
