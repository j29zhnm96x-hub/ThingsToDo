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
import { showToast } from '../ui/toast.js';
import { t } from '../utils/i18n.js';
import { renderVoiceMemoList, openRecordingModal } from '../ui/voiceMemo.js';

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
      const pTodos = await db.todos.listByProject(p.id);
      const nonArchived = pTodos.filter((t) => !t.archived);
      const total = nonArchived.length;
      const completed = nonArchived.filter(t => t.completed).length;
      const active = total - completed;
      subProjectStats.set(p.id, { total, completed, active });
  }

  // Voice memos for this project
  const voiceMemos = await db.voiceMemos.listByProject(projectId);

  // Render Sub-projects section
  let subProjectsList = null;
  let ignoreSubProjectClick = false; // Flag to prevent click after drag

  if (subProjects.length > 0) {
      subProjectsList = el('div', { class: 'list', style: { marginBottom: '16px' } });
      
      subProjects.forEach(p => {
          const stats = subProjectStats.get(p.id);

          const card = renderProjectCard({
            project: p,
            stats,
            onOpen: () => {
              if (ignoreSubProjectClick) return;
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
        ignoreSubProjectClick = false;
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
          ignoreSubProjectClick = true;
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
          setTimeout(() => { ignoreSubProjectClick = false; }, 50);
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
      modalHost,
      onToggleCompleted: async (todo, checked) => {
        await db.todos.put({
          ...todo,
          completed: checked,
          completedAt: checked ? new Date().toISOString() : null
        });
        await renderProjectDetail(ctx, projectId);
      },
      onTap: (todo) => {
        // Show full text modal
        openModal(modalHost, {
          title: 'Item Details',
          content: el('div', { style: 'word-wrap: break-word; white-space: pre-wrap;' }, todo.title),
          actions: [
            { label: t('edit'), class: 'btn', onClick: () => { 
              // Use setTimeout to let the modal close first before opening the edit modal
              setTimeout(() => openEditChecklistItem({ modalHost, db, todo, onSaved: () => renderProjectDetail(ctx, projectId) }), 50);
              return true; 
            } },
            { label: t('close'), class: 'btn btn--primary', onClick: () => true }
          ]
        });
      },
      onEdit: (todo) => {
        openEditChecklistItem({ modalHost, db, todo, onSaved: () => renderProjectDetail(ctx, projectId) });
      },
      onDelete: async (todo, rowElement) => {
        if (todo.protected) {
          openModal(modalHost, {
            title: 'Task Protected',
            content: el('div', {}, 'This task is protected. Please uncheck "Protect task" in the editor to delete it.'),
            actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }]
          });
          // Reset row position if it was swiped
          if (rowElement) {
            rowElement.style.transition = 'transform 200ms ease';
            rowElement.style.transform = 'translateX(0)';
          }
          return;
        }
        const ok = await confirm(modalHost, {
          title: 'Delete item?',
          message: `Delete "${todo.title}"?`,
          confirmLabel: 'Delete',
          danger: true,
          align: 'center'
        });
        if (!ok) {
          // Reset row position if cancelled
          if (rowElement) {
            rowElement.style.transition = 'transform 200ms ease';
            rowElement.style.transform = 'translateX(0)';
          }
          return;
        }
        await db.todos.delete(todo.id);
        await renderProjectDetail(ctx, projectId);
      },
      onDeleteAllCompleted: async () => {
        const completedTodos = todos.filter(t => t.completed);
        const unprotected = completedTodos.filter(t => !t.protected);
        const protectedCount = completedTodos.length - unprotected.length;
        
        if (unprotected.length === 0) {
          if (protectedCount > 0) {
            openModal(modalHost, {
              title: 'All Protected',
              content: el('div', {}, 'All completed items are protected and cannot be deleted.'),
              actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }]
            });
          }
          return;
        }
        
        const message = protectedCount > 0
          ? `Delete ${unprotected.length} completed items? (${protectedCount} protected items will be kept)`
          : `Delete all ${unprotected.length} completed items?`;
        
        const ok = await confirm(modalHost, {
          title: 'Delete completed?',
          message,
          confirmLabel: 'Delete All',
          danger: true,
          align: 'center'
        });
        if (!ok) return;
        
        for (const todo of unprotected) {
          await db.todos.delete(todo.id);
        }
        await renderProjectDetail(ctx, projectId);
      }
    });

    const hint = el('div', { class: 'checklist__hint' }, 'Double tap to add');
    
    // Exit button in Focus Mode now uses the header toggle, no extra button needed on screen.

    // Inner stack for content layout
    const contentStack = el('div', { class: 'stack' }, 
       subProjectsList, // Add sub-projects list at the top (if any)
       listEl, 
       hint
    );

    // Outer container for double-tap detection area
    const container = el('div', { 
      style: 'min-height: calc(100vh - 44px - var(--safe-top) - 74px - var(--safe-bottom) - 28px);'
    }, contentStack);

    main.append(container);

    const triggerAdd = () => quickAddChecklist({ modalHost, db, projectId, onCreated: () => renderProjectDetail(ctx, projectId) });

    // Touch double-tap detection - attach to container for full screen coverage within checklist area.
    let lastTap = 0;
    
    container.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTap < 350) {
        e.preventDefault();
        triggerAdd();
      }
      lastTap = now;
    }, { passive: false });

    // Mouse/trackpad double-click fallback.
    container.addEventListener('dblclick', (e) => { e.preventDefault(); triggerAdd(); });

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
        const wasLinked = todo.showInInbox;
        await db.todos.put({ ...todo, showInInbox: !todo.showInInbox });
        await renderProjectDetail(ctx, projectId);
        
        // Show success toast
        const message = wasLinked ? t('taskUnlinkedFromInbox') : t('taskLinkedToInbox');
        showToast(message);
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
             const wasLinked = todo.showInInbox;
             await db.todos.put({ ...todo, showInInbox: !todo.showInInbox });
             await renderProjectDetail(ctx, projectId);
             
             // Show success toast (modal will close automatically via return true)
             const message = wasLinked ? t('taskUnlinkedFromInbox') : t('taskLinkedToInbox');
             showToast(message);
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

  // Voice memos section
  const voiceMemosList = voiceMemos.length
    ? el('div', { style: 'margin-top: 16px;' },
        el('div', { style: 'font-size: 0.8125rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; padding: 0 4px;' }, t('voiceMemos')),
        renderVoiceMemoList({
          memos: voiceMemos,
          modalHost,
          db,
          projects,
          onChange: () => renderProjectDetail(ctx, projectId)
        })
      )
    : null;

  main.append(el('div', { class: 'stack' }, 
      subProjectsList, // Add sub-projects list at the top
      voiceMemosList,
      todos.length ? list : el('div', { class: 'card small' }, 'No todos in this project yet. Tap + to add one.')
  ));
}

// New function to handle the "+" menu
export function openProjectAddMenu(ctx, project) {
    const { modalHost, db } = ctx;
    
    // Bottom sheet style
    openModal(modalHost, {
        title: t('addToProject') || 'Add to Project',
        align: 'bottom',
        content: el('div', { class: 'stack' }, 
            el('button', { 
                class: 'btn btn--primary',
                style: { justifyContent: 'flex-start', padding: '16px' }, 
                onClick: () => {
                   ctx.openTodoEditor({ mode: 'create', projectId: project.id });
                   return true; // close modal
                }
            }, '📄 ' + t('newTask')),
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
            }, '📁 ' + t('newSubProject')),
            el('button', { 
                class: 'btn', 
                style: { justifyContent: 'flex-start', padding: '16px' }, 
                onClick: () => {
                   openRecordingModal({
                     modalHost,
                     db,
                     projectId: project.id,
                     onSaved: () => renderProjectDetail(ctx, project.id)
                   });
                   return true; // close modal
                }
            }, '🎤 ' + t('voiceMemo'))
        ),
        actions: [
            { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true }
        ]
    });
}

function renderChecklist({ todos, modalHost, onToggleCompleted, onDelete, onDeleteAllCompleted, onTap, onEdit }) {
  const active = todos.filter(todo => !todo.completed);
  const done = todos.filter(todo => todo.completed);

  // Load collapsed state from localStorage
  const storageKey = 'checklist-completed-collapsed';
  let isCollapsed = localStorage.getItem(storageKey) === 'true';

  const makeRow = (todo, completed) => {
    let pressTimer = null;
    const LONG_PRESS_DURATION = 500; // 0.5 seconds

    // Swipe tracking
    let startX = 0;
    let currentX = 0;
    let swiping = false;
    const SWIPE_THRESHOLD = 80;

    const textSpan = el('span', { 
      class: 'checklist__text',
      style: 'cursor: pointer;'
    }, todo.title);

    const row = el('div', {
      class: completed ? 'checklist__item checklist__item--done' : 'checklist__item',
      style: 'position: relative; overflow: hidden;'
    },
      el('span', { 
        class: completed ? 'checklist__circle checklist__circle--done' : 'checklist__circle',
        onClick: (e) => {
          e.stopPropagation();
          onToggleCompleted?.(todo, !completed);
        }
      }, completed ? '✓' : ''),
      textSpan,
      todo.protected ? el('span', { class: 'icon-protected', 'aria-label': 'Protected' }, '🔒') : null
    );

    // Long press to show actions menu
    let longPressTriggered = false;
    let pressStartTime = 0;
    let pressStartPos = { x: 0, y: 0 };
    
    const cancelPressTimer = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };
    
    const handlePressStart = (e) => {
      if (swiping) return;
      longPressTriggered = false;
      pressStartTime = Date.now();
      pressStartPos = { x: e.clientX, y: e.clientY };
      
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        hapticLight();
        // Show actions modal with Edit and Delete
        openModal(modalHost, {
          title: todo.title,
          content: el('div', { class: 'small' }, 'Choose an action'),
          actions: [
            { label: t('edit'), class: 'btn', onClick: () => { 
              // Use setTimeout to let the modal close first before opening the edit modal
              setTimeout(() => onEdit?.(todo), 50);
              return true; 
            } },
            { label: t('delete'), class: 'btn btn--danger', onClick: () => { onDelete?.(todo, row); return true; } },
            { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true }
          ]
        });
      }, LONG_PRESS_DURATION);
    };

    const handlePressEnd = (e) => {
      const pressDuration = Date.now() - pressStartTime;
      const moveDistance = e ? Math.hypot(e.clientX - pressStartPos.x, e.clientY - pressStartPos.y) : 999;
      
      cancelPressTimer();
      
      // If it was a quick tap (less than 300ms) and no movement, trigger tap
      if (pressDuration < 300 && moveDistance < 10 && !swiping && !longPressTriggered) {
        setTimeout(() => {
          if (!longPressTriggered) {
            hapticLight();
            onTap?.(todo);
          }
        }, 0);
      }
      
      // Reset longPressTriggered after a short delay
      setTimeout(() => {
        longPressTriggered = false;
      }, 100);
    };

    // Swipe left to delete
    const handleTouchStart = (e) => {
      startX = e.touches[0].clientX;
      currentX = startX;
      swiping = false;
    };

    const handleTouchMove = (e) => {
      currentX = e.touches[0].clientX;
      const diff = startX - currentX;
      
      if (diff > 20) {
        swiping = true;
        cancelPressTimer(); // Cancel long press if swiping
        const translateX = Math.min(diff, SWIPE_THRESHOLD + 20);
        row.style.transform = `translateX(-${translateX}px)`;
        row.style.transition = 'none';
      }
    };

    const handleTouchEnd = () => {
      const diff = startX - currentX;
      
      if (diff > SWIPE_THRESHOLD) {
        // Swipe detected - delete
        row.style.transition = 'transform 200ms ease';
        row.style.transform = 'translateX(-100%)';
        setTimeout(() => {
          hapticLight();
          onDelete?.(todo, row);
        }, 150);
      } else {
        // Reset position
        row.style.transition = 'transform 200ms ease';
        row.style.transform = 'translateX(0)';
      }
      swiping = false;
    };

    textSpan.addEventListener('pointerdown', handlePressStart);
    textSpan.addEventListener('pointerup', handlePressEnd);
    textSpan.addEventListener('pointercancel', () => {
      cancelPressTimer();
      longPressTriggered = false;
    });
    textSpan.addEventListener('pointerleave', cancelPressTimer);

    row.addEventListener('touchstart', handleTouchStart, { passive: true });
    row.addEventListener('touchmove', handleTouchMove, { passive: true });
    row.addEventListener('touchend', handleTouchEnd);

    return row;
  };

  const container = el('div', { class: 'checklist' });
  active.forEach(todo => container.appendChild(makeRow(todo, false)));
  
  if (done.length) {
    // Create collapsible completed section
    let pressTimer = null;
    
    const dividerBtn = el('button', { 
      type: 'button',
      class: 'todo-divider__text',
      style: 'cursor: pointer;'
    }, `Completed (${done.length})`);
    
    // Single tap to toggle collapse, long press (1 sec) to delete all
    const handlePressStart = () => {
      pressTimer = setTimeout(() => {
        // Long press detected - delete all completed
        hapticLight();
        onDeleteAllCompleted?.();
      }, 1000);
    };

    const handlePressEnd = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    dividerBtn.addEventListener('click', () => {
      // Single click - toggle collapse
      isCollapsed = !isCollapsed;
      localStorage.setItem(storageKey, isCollapsed);
      updateCompletedVisibility();
    });

    dividerBtn.addEventListener('pointerdown', handlePressStart);
    dividerBtn.addEventListener('pointerup', handlePressEnd);
    dividerBtn.addEventListener('pointercancel', handlePressEnd);
    dividerBtn.addEventListener('pointerleave', handlePressEnd);

    const divider = el('div', { class: 'todo-divider' }, dividerBtn);
    container.appendChild(divider);

    // Collapsed stack representation (thin lines)
    const stack = el('div', { 
      class: 'completedStack',
      style: isCollapsed ? '' : 'display: none;'
    });
    const lineCount = Math.min(done.length, 15);
    for (let i = 0; i < lineCount; i++) {
      stack.appendChild(el('div', { class: 'completedStack__line' }));
    }
    container.appendChild(stack);

    // Completed items
    const completedItems = [];
    done.forEach(todo => {
      const row = makeRow(todo, true);
      if (isCollapsed) row.style.display = 'none';
      completedItems.push(row);
      container.appendChild(row);
    });

    // Function to update visibility
    const updateCompletedVisibility = () => {
      stack.style.display = isCollapsed ? '' : 'none';
      completedItems.forEach(item => {
        item.style.display = isCollapsed ? 'none' : '';
      });
    };
  }
  
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

function openEditChecklistItem({ modalHost, db, todo, onSaved }) {
  const input = el('input', { class: 'input', value: todo.title, 'aria-label': 'Item name' });

  const saveItem = async () => {
    const title = input.value.trim();
    if (!title) {
      input.focus();
      return false;
    }
    await db.todos.put({ ...todo, title });
    onSaved?.();
    return true;
  };

  openModal(modalHost, {
    title: 'Edit item',
    content: input,
    align: 'top',
    headerActions: [
      { label: 'Save', class: 'btn btn--primary', onClick: saveItem }
    ],
    actions: [
      { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true },
      {
        label: 'Save',
        class: 'btn btn--primary',
        onClick: saveItem
      }
    ]
  });

  // Focus immediately (synchronously) to trigger mobile keyboard during the user gesture.
  try { input.focus(); input.select?.(); } catch (e) { /* ignore */ }
}
