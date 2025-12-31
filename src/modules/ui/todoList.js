import { el, humanDue } from './dom.js';
import { compareTodos } from '../logic/sorting.js';
import { daysLeftText, daysLeftClass } from './todoInfo.js';

export function renderTodoList({
  todos,
  projectsById,
  onToggleCompleted,
  onEdit,
  onMove,
  onArchive,
  onRestore,
  onDelete,
  onMenu,
  onReorder,
  onTap,
  mode // 'active' | 'archive'
}) {
  const list = el('div', { class: 'list' });

  const sorted = [...todos].sort(compareTodos);

  for (const t of sorted) {
    const due = humanDue(t.dueDate);
    const daysLeft = daysLeftText(t.dueDate);
    const daysLeftCls = daysLeftClass(t.dueDate);

    const menuBtn = el('button', {
      type: 'button',
      class: 'iconBtn todo__menuBtn',
      'aria-label': 'Menu',
      onClick: (e) => {
        e.stopPropagation();
        onMenu?.(t, { onEdit, onMove, onArchive, onRestore, onDelete, mode });
      }
    }, '…');

    const titleArea = el('div', {
      class: 'todo__titleArea',
      onClick: () => onTap?.(t)
    },
      el('div', { class: t.completed ? 'todo__title todo__title--done' : 'todo__title' }, t.title)
    );

    // Due date row with days left
    const row2 = (due || daysLeft) ? el('div', { class: 'todo__row2' },
      daysLeft ? el('span', { class: `dueTag ${daysLeftCls}` }, daysLeft) : null
    ) : null;

    const item = el('div', {
      class: 'todo',
      dataset: { todoId: t.id, priority: t.priority, projectId: t.projectId ?? '' },
      'aria-label': t.title
    },
    el('div', { class: 'todo__row1' },
      el('input', {
        type: 'checkbox',
        class: 'todo__check',
        'aria-label': `Mark ${t.title} completed`,
        checked: t.completed ? 'checked' : null,
        disabled: mode === 'archive' ? 'disabled' : null,
        onChange: (e) => {
          e.stopPropagation();
          onToggleCompleted?.(t, e.target.checked);
        }
      }),
      titleArea,
      menuBtn
    ),
    row2);

    list.appendChild(item);
  }

  // Touch-friendly drag reordering (within same priority bucket).
  // We keep existing sorting rules: priority groups remain fixed.
  if (typeof onReorder === 'function') {
    let pointerId = null;
    let dragged = null;
    let placeholder = null;
    let started = false;
    let startY = 0;
    let offsetY = 0;
    let rect = null;

    const threshold = 6;

    const isInteractive = (node) => !!node.closest('button, input, a, select, textarea');
    const cardFromEvent = (e) => e.target.closest('.todo');

    function cleanup() {
      if (dragged) {
        dragged.classList.remove('todo--dragging');
        dragged.style.left = '';
        dragged.style.top = '';
        dragged.style.width = '';
      }
      if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      pointerId = null;
      dragged = null;
      placeholder = null;
      started = false;
      rect = null;
    }

    function cardsInPriority(priority) {
      return Array.from(list.querySelectorAll(`.todo[data-priority="${priority}"]`));
    }

    async function finalize(priority, projectIdOrNull) {
      const ids = cardsInPriority(priority).map((n) => n.dataset.todoId);
      await onReorder({ priority, projectId: projectIdOrNull, orderedIds: ids });
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
      try { dragged.setPointerCapture(pointerId); } catch { /* ignore */ }
    });

    list.addEventListener('pointermove', (e) => {
      if (pointerId == null || e.pointerId !== pointerId || !dragged) return;

      const dy = e.clientY - startY;
      if (!started && Math.abs(dy) < threshold) return;

      if (!started) {
        started = true;
        placeholder = el('div', { class: 'todo todo--placeholder' });
        placeholder.style.height = `${rect.height}px`;
        dragged.parentNode.insertBefore(placeholder, dragged.nextSibling);

        dragged.classList.add('todo--dragging');
        dragged.style.width = `${rect.width}px`;
        dragged.style.left = `${rect.left}px`;
        dragged.style.top = `${rect.top}px`;
      }

      e.preventDefault();

      dragged.style.top = `${e.clientY - offsetY}px`;

      const priority = dragged.dataset.priority;
      const group = cardsInPriority(priority).filter((n) => n !== dragged);
      if (!group.length) return;

      // Clamp placeholder movement to this priority group.
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

      const priority = dragged.dataset.priority;
      const projectIdRaw = dragged.dataset.projectId;
      const projectIdOrNull = projectIdRaw === '' ? null : projectIdRaw;
      const wasStarted = started;

      if (started && placeholder) {
        list.insertBefore(dragged, placeholder);
      }

      cleanup();

      // Persist ordering after the DOM is settled.
      if (wasStarted) {
        await finalize(priority, projectIdOrNull);
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
  }

  return list;
}
