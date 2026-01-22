import { el, humanDue } from './dom.js';
import { compareTodos } from '../logic/sorting.js';
import { daysLeftText, daysLeftClass } from './todoInfo.js';
import { hapticLight, hapticSelection } from './haptic.js';
import { t } from '../utils/i18n.js';

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
  onLinkToggle,
  onReorder,
  onTap,
  mode // 'active' | 'archive'
}) {
  const list = el('div', { class: 'list' });

  const FADE_OUT_MS = 1200;
  const SHIFT_DOWN_MS = 1500;
  const FADE_IN_MS = 1200;

  // Separate active and recently completed todos
  const activeTodos = todos.filter(todo => !todo.completed);
  const completedTodos = todos.filter(todo => todo.completed);
  
  // Sort each group
  const sortedActive = [...activeTodos].sort(compareTodos);
  const sortedCompleted = [...completedTodos].sort((a, b) => {
    // Sort by completedAt descending (most recently completed first)
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bTime - aTime;
  });

  function renderCard(todo) {
    const due = humanDue(todo.dueDate);
    const daysLeft = daysLeftText(todo.dueDate);
    const daysLeftCls = daysLeftClass(todo.dueDate);

    const dueTagInline = (!todo.completed && (due || daysLeft) && daysLeft)
      ? el('span', { class: `dueTag ${daysLeftCls} todo__dueInline` }, daysLeft)
      : null;

    const menuBtn = el('button', {
      type: 'button',
      class: 'iconBtn todo__menuBtn',
      'aria-label': 'Menu',
      onClick: (e) => {
        e.stopPropagation();
        hapticLight();
        onMenu?.(todo, { onEdit, onMove, onArchive, onRestore, onDelete, onLinkToggle, mode });
      }
    }, '⋯');

    const titleArea = el('div', {
      class: 'todo__titleArea',
      onClick: () => {
        hapticLight();
        onTap?.(todo);
      }
    },
      el('div', { class: todo.completed ? 'todo__title todo__title--done' : 'todo__title' }, todo.title)
    );

    const noteIcon = todo.notes ? el('span', { class: 'todo__noteIcon', 'aria-label': 'Has notes' }, '✏️') : null;
    const protectedIcon = todo.protected ? el('span', { class: 'icon-protected', 'aria-label': 'Protected' }, '🔒') : null;
    
    // Recurring icon if this is a recurring task
    const recurringIcon = todo.recurrenceType ? el('span', { 
      class: 'icon-recurring', 
      'aria-label': t('recurring') || 'Recurring',
      title: t('recurring') || 'Recurring'
    }, '↻') : null;
    
    // Link icon if showInInbox is true or isVirtualLink
    const linkIcon = (todo.showInInbox || todo.isVirtualLink) ? el('span', { 
      class: 'icon-protected', // Re-using protected style for size/margin
      style: { opacity: 0.6 },
      'aria-label': 'Linked to Inbox' 
    }, '🔗') : null;

    // Due date row removed (days-left pill is inline next to menu)
    const row2 = null;

    // Checkbox with checkmark span for iOS compatibility
    const checkbox = el('label', { class: 'todo__checkWrap' },
      el('input', {
        type: 'checkbox',
        class: 'todo__check',
        'aria-label': `Mark ${todo.title} completed`,
        checked: todo.completed ? 'checked' : null,
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
              onToggleCompleted?.(todo, true);
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
                  el('span', { class: 'todo-divider__text' }, t('completed'))
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
                setTimeout(() => onToggleCompleted?.(todo, true), FADE_IN_MS + 50);
              }, shiftDelay);
            }, FADE_OUT_MS);

            return;
          }

          onToggleCompleted?.(todo, nextState);
        }
      }),
      el('span', { class: 'todo__checkIcon' }, '✓')
    );

    const item = el('div', {
      class: 'todo',
      dataset: { todoId: todo.id, priority: todo.priority, projectId: todo.projectId ?? '', completed: todo.completed ? 'true' : 'false' },
      'aria-label': todo.title
    },
    el('div', { class: 'todo__row1' },
      checkbox,
      titleArea,
      el('div', { class: 'todo__icons' },
        dueTagInline,
        recurringIcon,
        noteIcon,
        protectedIcon,
        linkIcon,
        menuBtn
      )
    ),
    row2);

    return item;
  }

  // Render active todos
  for (const todo of sortedActive) {
    list.appendChild(renderCard(todo));
  }

  // Add divider and completed section if there are completed todos
  if (sortedCompleted.length > 0 && mode !== 'archive') {
    let isCollapsed = localStorage.getItem('completed-collapsed') === 'true';
    
    const dividerText = el('button', { 
      type: 'button',
      class: 'todo-divider__text',
      onClick: () => {
        hapticLight();
        isCollapsed = !isCollapsed;
        localStorage.setItem('completed-collapsed', isCollapsed.toString());
        
        const stack = list.querySelector('.completedStack');
        const cards = list.querySelectorAll('.todo--completed-item');
        
        if (!isCollapsed) {
          // Expand
          if (stack) stack.style.display = 'none';
          cards.forEach(c => c.style.display = 'grid');
        } else {
          // Collapse
          if (stack) stack.style.display = 'flex';
          cards.forEach(c => c.style.display = 'none');
        }
      }
    }, t('completed'));

    const divider = el('div', { class: 'todo-divider' }, dividerText);
    list.appendChild(divider);

    // Stack representation (green lines)
    const stack = el('div', { 
      class: 'completedStack', 
      style: { display: isCollapsed ? 'flex' : 'none' } 
    });
    // Limit lines to avoid huge stacks
    const lineCount = Math.min(sortedCompleted.length, 20); 
    for (let i = 0; i < lineCount; i++) {
      stack.appendChild(el('div', { class: 'completedStack__line' }));
    }
    list.appendChild(stack);

    for (const todo of sortedCompleted) {
      const card = renderCard(todo);
      card.classList.add('todo--completed-item');
      if (isCollapsed) card.style.display = 'none';
      list.appendChild(card);
    }
  } else if (mode === 'archive') {
    // Archive mode - render completed in normal order
    // Handled by parent caller usually, but if called directly:
    for (const todo of sortedCompleted) {
      list.appendChild(renderCard(todo));
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
    let downTime = 0;
    let scrollBaseline = 0;
    const appEl = typeof document !== 'undefined' ? document.getElementById('app') : null;
    let prevTouchAction = '';

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

      // Restore scrolling behavior
      document.body.classList.remove('dragging-reorder');
      list.style.touchAction = prevTouchAction;

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
      downTime = Date.now();
      scrollBaseline = appEl ? appEl.scrollTop : (document.scrollingElement?.scrollTop || 0);
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
        try { dragged.setPointerCapture(pointerId); } catch { /* ignore */ }

        // Prevent the browser from treating this as a scroll gesture while dragging.
        prevTouchAction = list.style.touchAction || '';
        list.style.touchAction = 'none';
        document.body.classList.add('dragging-reorder');

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
