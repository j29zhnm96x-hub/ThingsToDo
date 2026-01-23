import { el, clear, emptyState } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { newProject } from '../data/models.js';
import { hapticLight } from '../ui/haptic.js';
import { scheduleChecklistReminder } from '../notifications.js';
import { openProjectMenu } from '../ui/projectMenu.js';
import { renderProjectCard } from '../ui/projectCard.js';
import { t } from '../utils/i18n.js';
import { isDueNowOrPast } from '../logic/recurrence.js';

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

  const projectsById = new Map(allProjects.map(p => [p.id, p]));

  async function getAllTodosForProject(projectId, db, projectsById) {
    const todos = await db.todos.listByProject(projectId);
    const nonArchived = todos
      .filter((t) => !t.archived)
      .filter((t) => {
        if (t.isRecurringInstance && t.dueDate && !isDueNowOrPast(t.dueDate)) return false;
        return true;
      });
    const subprojects = Array.from(projectsById.values()).filter(p => p.parentId === projectId);
    for (const sub of subprojects) {
      const subTodos = await getAllTodosForProject(sub.id, db, projectsById);
      nonArchived.push(...subTodos);
    }
    return nonArchived;
  }

  // Get todo counts for each project
  const projectStats = new Map();
  for (const p of projects) {
    let total, completed, active;
    if (p.type === 'default') {
      const allTodos = await getAllTodosForProject(p.id, db, projectsById);
      total = allTodos.length;
      completed = allTodos.filter(t => t.completed).length;
      active = total - completed;
    } else {
      const todos = await db.todos.listByProject(p.id);
      const nonArchived = todos
        .filter((t) => !t.archived)
        .filter((t) => {
          if (t.isRecurringInstance && t.dueDate && !isDueNowOrPast(t.dueDate)) return false;
          return true;
        });
      total = nonArchived.length;
      completed = nonArchived.filter(t => t.completed).length;
      active = total - completed;
    }
    projectStats.set(p.id, { total, completed, active });
  }

  const list = el('div', { class: 'list' });
  
  // Touch-friendly drag reordering (exact copy of inbox todo behavior).
  let pointerId = null;
  let dragged = null;
  let placeholder = null;
  let started = false;
  let startY = 0;
  let offsetY = 0;
  let rect = null;
  let downTime = 0;
  let scrollBaseline = 0;
  const appEl = typeof document !== 'undefined' ? document.getElementById('app') : null;
  let prevTouchAction = '';
  let ignoreClick = false;

  const threshold = 6;

  const isInteractive = (node) => !!node.closest('button, input, a, select, textarea');
  const cardFromEvent = (e) => e.target.closest('.projectCard');

  function cleanup() {
    if (dragged) {
      dragged.classList.remove('todo--dragging');
      dragged.style.left = '';
      dragged.style.top = '';
      dragged.style.width = '';
    }
    if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);

    // Restore scrolling behavior
    document.body.classList.remove('dragging-reorder');
    list.style.touchAction = prevTouchAction;

    pointerId = null;
    dragged = null;
    placeholder = null;
    started = false;
    rect = null;
  }

  function getCards() {
    return Array.from(list.querySelectorAll('.projectCard[data-project-id]'));
  }

  async function finalize() {
    const orderedIds = getCards().map((n) => n.dataset.projectId);
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
    startY = e.clientY;
    rect = dragged.getBoundingClientRect();
    offsetY = e.clientY - rect.top;
    downTime = Date.now();
    scrollBaseline = appEl ? appEl.scrollTop : (document.scrollingElement?.scrollTop || 0);
    ignoreClick = false;
  });

  list.addEventListener('pointermove', (e) => {
    if (pointerId == null || e.pointerId !== pointerId || !dragged) return;

    const dy = e.clientY - startY;
    if (!started) {
      // If the app scroller moved, treat this as a scroll, not a drag.
      const currentScroll = appEl ? appEl.scrollTop : (document.scrollingElement?.scrollTop || 0);
      if (currentScroll !== scrollBaseline) return;

      // Require a brief hold to start drag to avoid accidental drags during scroll.
      const HOLD_MS = 120;
      if (Date.now() - downTime < HOLD_MS) return;

      if (Math.abs(dy) < threshold) return;
    }

    if (!started) {
      started = true;
      ignoreClick = true;
      try { dragged.setPointerCapture(pointerId); } catch { /* ignore */ }

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

    const group = getCards().filter((n) => n !== dragged);
    if (!group.length) return;

    // Clamp placeholder movement to the card group.
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

    const wasStarted = started;

    if (started && placeholder) {
      list.insertBefore(dragged, placeholder);
    }

    cleanup();

    // Persist ordering after the DOM is settled.
    if (wasStarted) {
      await finalize();
      setTimeout(() => { ignoreClick = false; }, 50);
    }
  });

  list.addEventListener('pointercancel', (e) => {
    if (pointerId == null || e.pointerId !== pointerId) return;
    // Put it back where it started.
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

  main.append(el('div', { class: 'stack' }, projects.length ? list : emptyState(t('noProjects'), t('noProjectsHint'))));


}

export function openCreateProject({ db, modalHost, onCreated, parentId = null }) {
  const nameInput = el('input', { class: 'input', placeholder: t('projectName'), 'aria-label': t('projectName') });
  const typeSelect = el('select', { class: 'select', 'aria-label': t('projectType') },
    el('option', { value: 'default', selected: 'selected' }, t('default')),
    el('option', { value: 'checklist' }, t('checklist'))
  );

  const useSuggestionsToggle = el('input', { type: 'checkbox', 'aria-label': t('useSuggestions') || 'Use suggestions' });
  const suggestionsRow = el('label', { class: 'label', style: 'display:none;' },
    el('span', {}, t('enableSuggestionsQuick') || 'Enable suggestions for quick item entry'),
    useSuggestionsToggle
  );

  const enableQtyUnitsToggle = el('input', { type: 'checkbox', 'aria-label': t('enableQtyUnits') || 'Enable quantity and units' });
  const qtyUnitsRow = el('label', { class: 'label', style: 'display:none;' },
    el('span', {}, t('enableQtyUnits') || 'Enable quantity and units for items'),
    enableQtyUnitsToggle
  );

  typeSelect.addEventListener('change', () => {
    const isChecklist = typeSelect.value === 'checklist';
    suggestionsRow.style.display = isChecklist ? '' : 'none';
    qtyUnitsRow.style.display = isChecklist ? '' : 'none';
  });

  const content = el('div', { class: 'stack' },
    el('label', { class: 'label' }, el('span', {}, t('projectName')), nameInput),
    el('label', { class: 'label' }, el('span', {}, t('projectType')), typeSelect),
    suggestionsRow,
    qtyUnitsRow
  );

  openModal(modalHost, {
    title: parentId ? t('newSubProject') : t('createProject'),
    content,
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true },
      {
        label: t('create'),
        class: 'btn btn--primary',
        onClick: async () => {
          const name = nameInput.value.trim();
          if (!name) {
            nameInput.focus();
            return false;
          }
          const type = typeSelect.value === 'checklist' ? 'checklist' : 'default';
          const project = newProject({ name, type, parentId, useSuggestions: type === 'checklist' ? useSuggestionsToggle.checked : false, enableQtyUnits: type === 'checklist' ? enableQtyUnitsToggle.checked : false });
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
