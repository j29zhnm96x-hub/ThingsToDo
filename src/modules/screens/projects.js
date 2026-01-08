import { el, clear, emptyState } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { newProject } from '../data/models.js';
import { hapticLight } from '../ui/haptic.js';
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
  projects.sort((a, b) => {
    // If both are numbers, compare numbers
    if (typeof a.sortOrder === 'number' && typeof b.sortOrder === 'number') {
      return a.sortOrder - b.sortOrder;
    }
    // Fallback to string comparison (ISO dates work fine)
    if (a.sortOrder < b.sortOrder) return -1;
    if (a.sortOrder > b.sortOrder) return 1;
    return 0;
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
  
  // Touch-friendly drag reordering (reuse inbox todo behavior).
  let pointerId = null;
  let dragged = null;
  let placeholder = null;
  let started = false;
  let startX = 0;
  let startY = 0;
  let offsetX = 0;
  let offsetY = 0;
  let rect = null;
  let downTime = 0;
  let scrollBaseline = 0;
  const appEl = typeof document !== 'undefined' ? document.getElementById('app') : null;
  let prevTouchAction = '';
  let ignoreClick = false;
  const threshold = 6;

  const cardFromEvent = (e) => e.target.closest('.projectCard');
  const isInteractive = (node) => !!node.closest('button, input, a, select, textarea') || !!node.closest('.projectCard__menuBtn');
  const cards = () => Array.from(list.querySelectorAll('.projectCard[data-project-id]'));

  function cleanup() {
    if (dragged) {
      dragged.classList.remove('todo--dragging');
      dragged.style.left = '';
      dragged.style.top = '';
      dragged.style.width = '';
    }
    if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);

    document.body.classList.remove('dragging-reorder');
    list.style.touchAction = prevTouchAction;

    pointerId = null;
    dragged = null;
    placeholder = null;
    started = false;
    rect = null;
  }

  async function finalize() {
    const orderedIds = cards().map((n) => n.dataset.projectId);
    for (let i = 0; i < orderedIds.length; i++) {
      const pid = orderedIds[i];
      const project = projects.find((p) => p.id === pid);
      if (project && project.sortOrder !== i) {
        project.sortOrder = i;
        await db.projects.put(project);
      }
    }
  }

  list.addEventListener('pointerdown', (e) => {
    if (pointerId != null) return;
    const card = cardFromEvent(e);
    if (!card) return;
    if (isInteractive(e.target)) return;

    pointerId = e.pointerId;
    dragged = card;
    startX = e.clientX;
    startY = e.clientY;
    rect = dragged.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    downTime = Date.now();
    scrollBaseline = appEl ? appEl.scrollTop : (document.scrollingElement?.scrollTop || 0);
    ignoreClick = false;
  });

  list.addEventListener('pointermove', (e) => {
    if (pointerId == null || e.pointerId !== pointerId || !dragged) return;

    const dy = e.clientY - startY;
    if (!started) {
      const currentScroll = appEl ? appEl.scrollTop : (document.scrollingElement?.scrollTop || 0);
      if (currentScroll !== scrollBaseline) return;

      const HOLD_MS = 120;
      if (Date.now() - downTime < HOLD_MS) return;

      if (Math.abs(dy) < threshold) return;
    }

    if (!started) {
      started = true;
      ignoreClick = true;
      try { dragged.setPointerCapture(pointerId); } catch { /* ignore */ }

      prevTouchAction = list.style.touchAction || '';
      list.style.touchAction = 'none';
      document.body.classList.add('dragging-reorder');

      placeholder = el('div', { class: 'projectCard todo--placeholder' });
      placeholder.style.height = `${rect.height}px`;
      placeholder.style.width = `${rect.width}px`;
      dragged.parentNode.insertBefore(placeholder, dragged.nextSibling);

      dragged.classList.add('todo--dragging');
      dragged.style.width = `${rect.width}px`;
      dragged.style.left = `${rect.left}px`;
      dragged.style.top = `${rect.top}px`;
      dragged.style.height = `${rect.height}px`;
    }

    e.preventDefault();

    dragged.style.left = `${e.clientX - offsetX}px`;
    dragged.style.top = `${e.clientY - offsetY}px`;

    const group = cards().filter((n) => n !== dragged);
    if (!group.length) return;

    const y = e.clientY;
    let inserted = false;
    for (const card of group) {
      const r = card.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (y < mid) {
        if (placeholder && placeholder !== card.previousSibling) {
          list.insertBefore(placeholder, card);
        }
        inserted = true;
        break;
      }
    }
    if (!inserted && placeholder) {
      const last = group[group.length - 1];
      if (last && last.nextSibling !== placeholder) {
        list.insertBefore(placeholder, last.nextSibling);
      }
    }
  }, { passive: false });

  list.addEventListener('pointerup', async (e) => {
    if (pointerId == null || e.pointerId !== pointerId || !dragged) return;

    const wasStarted = started;

    if (started && placeholder) {
      list.insertBefore(dragged, placeholder);
    }

    cleanup();

    if (wasStarted) {
      await finalize();
      setTimeout(() => { ignoreClick = false; }, 50);
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
