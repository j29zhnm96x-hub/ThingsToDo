import { el, clear, emptyState } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { confirm } from '../ui/confirm.js';
import { newProject } from '../data/models.js';
import { hapticLight, hapticSelection } from '../ui/haptic.js';
  let downTime = 0;
  let scrollBaseline = 0;
  const appEl = typeof document !== 'undefined' ? document.getElementById('app') : null;
import { scheduleChecklistReminder } from '../notifications.js';
import { openProjectMenu } from '../ui/projectMenu.js';
import { renderProjectCard } from '../ui/projectCard.js';

export async function renderProjects(ctx) {
  const { main, db, modalHost } = ctx;
  clear(main);

  // List all projects but filter to show only top-level (parentId == null)
  const allProjects = await db.projects.list();
  const projects = allProjects.filter(p => !p.parentId);

  // Normalize sortOrder: older projects (created before reordering was added) 
    downTime = Date.now();
    scrollBaseline = appEl ? appEl.scrollTop : (document.scrollingElement?.scrollTop || 0);
  projects.sort((a, b) => {
    // If both are numbers, compare numbers
    if (typeof a.sortOrder === 'number' && typeof b.sortOrder === 'number') {
      return a.sortOrder - b.sortOrder;
    }
    // Fallback to string comparison (ISO dates work fine)
    if (a.sortOrder < b.sortOrder) return -1;
    if (a.sortOrder > b.sortOrder) return 1;
    return 0;
      // If the app scroller moved, treat this as a scroll, not a drag.
      const currentScroll = appEl ? appEl.scrollTop : (document.scrollingElement?.scrollTop || 0);
      if (currentScroll !== scrollBaseline) return;

      // Require a brief hold to start drag to avoid accidental drags during scroll.
      const HOLD_MS = 120;
      if (Date.now() - downTime < HOLD_MS) return;
  });

  // Get todo counts for each project
  const projectStats = new Map();
  for (const p of projects) {
    const todos = await db.todos.listByProject(p.id);
    const nonArchived = todos.filter((t) => !t.archived);
    const total = nonArchived.length;
    const completed = nonArchived.filter(t => t.completed).length;
    const active = total - completed;
    projectStats.set(p.id, { total, completed, active });
  }

  const list = el('div', { class: 'list' });
  
  // Drag & Drop state
  let pointerId = null;
  let dragged = null;
  let placeholder = null;
  let started = false;
  let startY = 0;
  let offsetY = 0;
  let rect = null;
  let ignoreClick = false; // Flag to prevent click after drag
  const threshold = 6;
  let prevTouchAction = '';

  const cleanup = () => {
    if (dragged) {
      dragged.classList.remove('todo--dragging');
      dragged.style.width = '';
      dragged.style.left = '';
      dragged.style.top = '';
      dragged.style.height = ''; 
    }
    if (placeholder) placeholder.remove();

    // Restore scrolling behavior.
    list.style.touchAction = prevTouchAction;

    document.body.classList.remove('dragging-reorder');

    pointerId = null;
    dragged = null;
    placeholder = null;
    started = false;
    rect = null;
  };

  const cardFromEvent = (e) => e.target.closest('.projectCard');
  const isInteractive = (node) => !!node.closest('button, input, a, select, textarea') || !!node.closest('.projectCard__menuBtn');

  list.addEventListener('pointerdown', (e) => {
    if (pointerId != null) return;
    const card = cardFromEvent(e);
    if (!card) return;
    if (isInteractive(e.target)) return;

    pointerId = e.pointerId;
    dragged = card;
    startY = e.clientY;
    ignoreClick = false; // Reset flag
    rect = dragged.getBoundingClientRect();
    offsetY = e.clientY - rect.top;
    try { dragged.setPointerCapture(pointerId); } catch { /* ignore */ }
  });

  list.addEventListener('pointermove', (e) => {
    if (pointerId == null || e.pointerId !== pointerId || !dragged) return;

    const dy = e.clientY - startY;
    if (!started && Math.abs(dy) < threshold) return;

    if (!started) {
      started = true;
      ignoreClick = true; // Mark as drag to prevent click
      hapticSelection();

      // Prevent the browser from treating this as a scroll gesture while dragging.
      prevTouchAction = list.style.touchAction || '';
      list.style.touchAction = 'none';

      document.body.classList.add('dragging-reorder');

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

    const group = Array.from(list.querySelectorAll('.projectCard')).filter((n) => n !== dragged && n !== placeholder);
    if (!group.length) return;

    const y = e.clientY;
    let inserted = false;
    for (const card of group) {
      const r = card.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (y < mid) {
        if (placeholder !== card.previousSibling) {
          list.insertBefore(placeholder, card);
        }
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      const last = group[group.length - 1];
      if (last && last.nextSibling !== placeholder) {
        list.insertBefore(placeholder, last.nextSibling);
      }
    }
  }, { passive: false });

  list.addEventListener('pointerup', async (e) => {
    if (pointerId == null || e.pointerId !== pointerId || !dragged) return;
    try { dragged.releasePointerCapture(pointerId); } catch { /* ignore */ }

    const wasStarted = started;

    if (started && placeholder) {
      hapticLight();
      list.insertBefore(dragged, placeholder);
    }

    cleanup();

    if (wasStarted) {
       // Persist order
       const newOrder = Array.from(list.querySelectorAll('.projectCard[data-project-id]')).map((n) => n.dataset.projectId);
       
       for(let i=0; i<newOrder.length; i++) {
           const pid = newOrder[i];
           const p = projects.find(x => x.id === pid);
           if (p && p.sortOrder !== i) {
               p.sortOrder = i;
               await db.projects.put(p);
           }
       }
       
       // Keep ignoreClick true for a short moment to ensure click is skipped
       setTimeout(() => { ignoreClick = false; }, 100);
    }
  });
  
  list.addEventListener('pointercancel', (e) => {
     if (pointerId == null || e.pointerId !== pointerId) return;
     if (started && placeholder && dragged) {
         list.insertBefore(dragged, placeholder);
     }
     cleanup();
  });

  projects.forEach((p) => {
    const stats = projectStats.get(p.id) || { total: 0, completed: 0, active: 0 };

    const card = renderProjectCard({
      project: p,
      stats,
      onOpen: () => {
        if (ignoreClick) return;
        hapticLight();
        location.hash = `#project/${p.id}`;
      },
      onMenu: () => {
        hapticLight();
        openProjectMenu(modalHost, { db, project: p, onChange: () => renderProjects(ctx) });
      }
    });

    list.appendChild(card);
  });

  main.append(el('div', { class: 'stack' }, projects.length ? list : emptyState('No projects yet', 'Tap the + button above to create your first project')));


}

export function openCreateProject({ db, modalHost, onCreated, parentId = null }) {
  const nameInput = el('input', { class: 'input', placeholder: 'Project name', 'aria-label': 'Project name' });
  const typeSelect = el('select', { class: 'select', 'aria-label': 'Project type' },
    el('option', { value: 'default', selected: 'selected' }, 'Default'),
    el('option', { value: 'checklist' }, 'Check List')
  );

  const content = el('div', { class: 'stack' },
    el('label', { class: 'label' }, el('span', {}, 'Name'), nameInput),
    el('label', { class: 'label' }, el('span', {}, 'Project Type'), typeSelect)
  );

  openModal(modalHost, {
    title: 'Create Project',
    content,
    actions: [
      { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true },
      {
        label: 'Create',
        class: 'btn btn--primary',
        onClick: async () => {
          const name = nameInput.value.trim();
          if (!name) {
            nameInput.focus();
            return false;
          }
          const type = typeSelect.value === 'checklist' ? 'checklist' : 'default';
          const project = newProject({ name, type, parentId });
          await db.projects.put(project);
          
          if (type === 'checklist') {
            scheduleChecklistReminder(project.id);
          }

          onCreated?.();
          return true;
        }
      }
    ]
  });

  requestAnimationFrame(() => nameInput.focus());
}
