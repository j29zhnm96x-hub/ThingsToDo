import { el, humanDue } from './dom.js';
import { compareTodos } from '../logic/sorting.js';
import { daysLeftText, daysLeftClass } from './todoInfo.js';
import { hapticLight, hapticSelection } from './haptic.js';

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

  const FADE_OUT_MS = 1200;
  const SHIFT_DOWN_MS = 1500;
  const FADE_IN_MS = 1200;

  // Separate active and recently completed todos
  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);
  
  // Sort each group
  const sortedActive = [...activeTodos].sort(compareTodos);
  const sortedCompleted = [...completedTodos].sort((a, b) => {
    // Sort by completedAt descending (most recently completed first)
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bTime - aTime;
  });

  function renderCard(t) {
    const due = humanDue(t.dueDate);
    const daysLeft = daysLeftText(t.dueDate);
    const daysLeftCls = daysLeftClass(t.dueDate);

    const dueTagInline = (!t.completed && (due || daysLeft) && daysLeft)
      ? el('span', { class: `dueTag ${daysLeftCls} todo__dueInline` }, daysLeft)
      : null;

    const menuBtn = el('button', {
      type: 'button',
      class: 'iconBtn todo__menuBtn',
      'aria-label': 'Menu',
      onClick: (e) => {
        e.stopPropagation();
        hapticLight();
        onMenu?.(t, { onEdit, onMove, onArchive, onRestore, onDelete, mode });
      }
    }, '⋯');

    const titleArea = el('div', {
      class: 'todo__titleArea',
      onClick: () => {
        hapticLight();
        onTap?.(t);
      }
    },
      el('div', { class: t.completed ? 'todo__title todo__title--done' : 'todo__title' }, t.title)
    );

    const noteIcon = t.notes ? el('span', { class: 'todo__noteIcon', 'aria-label': 'Has notes' }, '✏️') : null;

    // Due date row removed (days-left pill is inline next to menu)
    const row2 = null;

    // Checkbox with checkmark span for iOS compatibility
    const checkbox = el('label', { class: 'todo__checkWrap' },
      el('input', {
        type: 'checkbox',
        class: 'todo__check',
        'aria-label': `Mark ${t.title} completed`,
        checked: t.completed ? 'checked' : null,
        disabled: mode === 'archive' ? 'disabled' : null,
        onChange: (e) => {
          e.stopPropagation();
          hapticSelection();
          const card = e.target.closest('.todo');
          const nextState = e.target.checked;

          // Beautiful completion animation (in-place DOM) so cards don't jump.
          if (nextState && card && mode !== 'archive') {
            const listEl = card.closest('.list');
            if (!listEl) {
              onToggleCompleted?.(t, true);
              return;
            }

            const cardRect = card.getBoundingClientRect();
            const cardHeight = cardRect.height;

            card.classList.add('todo--fadeOut', 'todo--animating');

            setTimeout(() => {
              // Remove from active list after fade-out.
              try { card.parentNode?.removeChild(card); } catch { /* ignore */ }

              // Ensure Completed divider exists.
              let divider = listEl.querySelector('.todo-divider');
              if (!divider) {
                divider = el('div', { class: 'todo-divider' },
                  el('span', { class: 'todo-divider__text' }, 'Completed')
                );
                listEl.appendChild(divider);
              }

              const completedCards = Array.from(listEl.querySelectorAll('.todo-divider ~ .todo'));

              // Insert an invisible placeholder that reserves the slot.
              const placeholder = el('div', { class: 'todo todo--slot', 'aria-hidden': 'true' });
              placeholder.style.height = `${cardHeight}px`;

              if (completedCards.length) {
                // Record "first" positions before DOM change.
                const firstTops = new Map(completedCards.map((n) => [n, n.getBoundingClientRect().top]));

                // Insert placeholder (DOM change).
                divider.after(placeholder);

                // Record "last" positions after DOM change.
                const lastTops = new Map(completedCards.map((n) => [n, n.getBoundingClientRect().top]));

                // FLIP: Apply inverse transform WITHOUT transition so they appear at old position.
                for (const n of completedCards) {
                  const dy = (firstTops.get(n) ?? 0) - (lastTops.get(n) ?? 0);
                  if (!dy) continue;
                  // Disable transition temporarily
                  n.style.transition = 'none';
                  n.style.transform = `translateY(${dy}px)`;
                }

                // Force reflow so the "instant" transform is applied.
                void listEl.offsetHeight;

                // Now enable transition and animate to final position (transform: none).
                requestAnimationFrame(() => {
                  for (const n of completedCards) {
                    n.style.transition = '';
                    n.classList.add('todo--flipMove');
                    n.style.transform = '';
                  }
                });
              } else {
                divider.after(placeholder);
              }

              const shiftDelay = completedCards.length ? SHIFT_DOWN_MS : 0;
              setTimeout(() => {
                // Put the card into the reserved slot and fade it in.
                card.classList.remove('todo--fadeOut', 'todo--animating');
                card.classList.add('todo--newCompleted');
                placeholder.replaceWith(card);

                // Cleanup flip classes after they finish.
                if (completedCards.length) {
                  setTimeout(() => {
                    for (const n of completedCards) n.classList.remove('todo--flipMove');
                  }, 50);
                }

                // Persist after the visual completes (avoids re-render hiccup mid-animation).
                setTimeout(() => onToggleCompleted?.(t, true), FADE_IN_MS + 50);
              }, shiftDelay);
            }, FADE_OUT_MS);

            return;
          }

          onToggleCompleted?.(t, nextState);
        }
      }),
      el('span', { class: 'todo__checkIcon' }, '✓')
    );

    const item = el('div', {
      class: 'todo',
      dataset: { todoId: t.id, priority: t.priority, projectId: t.projectId ?? '' },
      'aria-label': t.title
    },
    el('div', { class: 'todo__row1' },
      checkbox,
      titleArea,
      dueTagInline,
      noteIcon,
      menuBtn
    ),
    row2);

    return item;
  }

  // Render active todos
  for (const t of sortedActive) {
    list.appendChild(renderCard(t));
  }

  // Add divider and completed section if there are completed todos
  if (sortedCompleted.length > 0 && mode !== 'archive') {
    const divider = el('div', { class: 'todo-divider' },
      el('span', { class: 'todo-divider__text' }, 'Completed')
    );
    list.appendChild(divider);

    for (const t of sortedCompleted) {
      list.appendChild(renderCard(t));
    }
  } else {
    // Archive mode - render completed in normal order
    for (const t of sortedCompleted) {
      list.appendChild(renderCard(t));
    }
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
