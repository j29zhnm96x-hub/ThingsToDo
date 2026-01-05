import { el, clear, emptyState } from '../ui/dom.js';
import { renderTodoList } from '../ui/todoList.js';
import { pickProject } from '../ui/pickProject.js';
import { confirm } from '../ui/confirm.js';
import { restoreTodo, recycleTodos, restoreFromBin } from '../logic/todoOps.js';
import { openTodoMenu } from '../ui/todoMenu.js';
import { openTodoInfo } from '../ui/todoInfo.js';
import { hapticLight } from '../ui/haptic.js';
import { openModal } from '../ui/modal.js';
import { openBinModal } from '../ui/binModal.js';

async function buildProjectsById(db) {
  const projects = await db.projects.list();
  const map = new Map(projects.map((p) => [p.id, p]));
  return { projects, map };
}

export async function renderArchive(ctx) {
  const { main, db, modalHost, topbarActions } = ctx;
  clear(main);

  // Add Bin button to topbar
  topbarActions.innerHTML = '';
  const binBtn = el('button', { 
    class: 'topbar__addBtn', 
    type: 'button', 
    'aria-label': 'Bin', 
    onClick: () => openBinModal(ctx, { onRestore: () => renderArchive(ctx) }) 
  }, '↺');
  topbarActions.append(binBtn);

  const archived = await db.todos.listArchived();
  const { projects, map: projectsById } = await buildProjectsById(db);

  if (archived.length === 0) {
    main.append(emptyState('No archived todos', 'Todos you archive will appear here'));
    return;
  }

  // Group by date
  const groups = new Map();
  for (const t of archived) {
    const date = t.completedAt ? new Date(t.completedAt).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    }) : 'Unknown date';
    
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(t);
  }

  // Sort groups by date descending
  const sortedDates = Array.from(groups.keys()).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const listContainer = el('div', { class: 'list' });

  // Load collapsed state
  let collapsedState = {};
  try {
    collapsedState = JSON.parse(localStorage.getItem('archive-collapsed') || '{}');
  } catch { /* ignore */ }

  // Calculate allCollapsed
  const allCollapsed = sortedDates.every(d => collapsedState[d]);

  // Create Collapse/Expand button
  const collapseBtn = el('button', {
      class: 'topbar__addBtn',
      type: 'button',
      'aria-label': allCollapsed ? 'Expand all' : 'Collapse all',
      style: 'margin-right: 12px;', 
      onClick: () => {
        hapticLight();
        const newState = !allCollapsed;
        sortedDates.forEach(d => {
          collapsedState[d] = newState;
        });
        localStorage.setItem('archive-collapsed', JSON.stringify(collapsedState));
        renderArchive(ctx);
      }
  }, allCollapsed ? '▼' : '▲');

  // Insert before Bin button
  topbarActions.insertBefore(collapseBtn, binBtn);

  for (const date of sortedDates) {
    const groupTodos = groups.get(date);
    const isCollapsed = !!collapsedState[date];

    // Divider
    const dividerText = el('button', {
      type: 'button',
      class: 'todo-divider__text'
    }, date);

    // Long press to delete group
    let pressTimer = null;
    let longPressTriggered = false;

    const cancelPress = () => {
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    dividerText.addEventListener('pointerdown', (e) => {
      longPressTriggered = false;
      pressTimer = setTimeout(async () => {
        longPressTriggered = true;
        hapticLight();
        
        const ok = await confirm(modalHost, {
          title: 'Delete group?',
          message: `Delete all ${groupTodos.length} archived todos from ${date}?`,
          confirmLabel: 'Delete All',
          danger: true
        });
        
        if (ok) {
          await recycleTodos(db, groupTodos);
          await renderArchive(ctx);
        }
      }, 1000);
    });

    dividerText.addEventListener('pointerup', (e) => {
      cancelPress();
      if (!longPressTriggered) {
        // Normal toggle behavior
        hapticLight();
        const nextState = !collapsedState[date];
        collapsedState[date] = nextState;
        localStorage.setItem('archive-collapsed', JSON.stringify(collapsedState));
        
        // Toggle visibility
        const stack = listContainer.querySelector(`[data-stack-date="${date}"]`);
        const cards = listContainer.querySelectorAll(`[data-card-date="${date}"]`);
        
        if (nextState) {
          if (stack) stack.style.display = 'flex';
          cards.forEach(c => c.style.display = 'none');
        } else {
          if (stack) stack.style.display = 'none';
          cards.forEach(c => c.style.display = 'grid');
        }
      }
    });

    dividerText.addEventListener('pointercancel', cancelPress);
    dividerText.addEventListener('pointerleave', cancelPress);
    dividerText.addEventListener('contextmenu', (e) => e.preventDefault());

    listContainer.appendChild(el('div', { class: 'todo-divider' }, dividerText));

    // Stack visual
    const stack = el('div', { 
      class: 'completedStack', 
      'data-stack-date': date,
      style: { display: isCollapsed ? 'flex' : 'none' } 
    });
    const lineCount = Math.min(groupTodos.length, 20);
    for (let i = 0; i < lineCount; i++) {
      stack.appendChild(el('div', { class: 'completedStack__line' }));
    }
    listContainer.appendChild(stack);

    // Render items using the shared renderTodoList logic but we just want the cards
    // Since renderTodoList creates a wrapper, we'll use a temporary container and move children
    
    const tempContainer = renderTodoList({
      todos: groupTodos,
      projectsById,
      mode: 'archive', // This prevents the "Completed" divider inside the group
      onTap: (todo) => openTodoInfo({
        todo,
        db,
        modalHost,
        onEdit: () => ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db })
      }),
      onEdit: (todo) => ctx.openTodoEditor({ mode: 'edit', todoId: todo.id, projectId: todo.projectId, db }),
      onRestore: async (todo) => {
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
        await recycleTodos(db, [todo]);
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
              await recycleTodos(db, [todo]);
              await renderArchive(ctx);
            }
            return true;
          } }
        ]
      })
    });

    // Move cards from temp container to main list
    Array.from(tempContainer.children).forEach(child => {
      if (child.classList.contains('todo')) {
        child.dataset.cardDate = date;
        if (isCollapsed) child.style.display = 'none';
        listContainer.appendChild(child);
      }
    });
  }

  main.append(listContainer);
}
