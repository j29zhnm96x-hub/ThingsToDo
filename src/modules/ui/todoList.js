import { el, humanDue } from './dom.js';
import { compareTodos } from '../logic/sorting.js';

function priorityBadge(priority) {
  const cls = priority === 'P0' ? 'badge badge--p0'
    : priority === 'P1' ? 'badge badge--p1'
    : priority === 'P2' ? 'badge badge--p2'
    : 'badge badge--p3';
  return el('span', { class: cls }, priority);
}

export function renderTodoList({
  todos,
  projectsById,
  onToggleCompleted,
  onEdit,
  onMove,
  onArchive,
  onRestore,
  onDelete,
  onMoveUp,
  onMoveDown,
  mode // 'active' | 'archive'
}) {
  const list = el('div', { class: 'list' });

  const sorted = [...todos].sort(compareTodos);

  // Helper to find reorder boundaries within same priority
  const byPriority = new Map();
  for (const t of sorted) {
    const key = t.priority;
    const arr = byPriority.get(key) || [];
    arr.push(t.id);
    byPriority.set(key, arr);
  }

  for (const t of sorted) {
    const due = humanDue(t.dueDate);
    const projectName = t.projectId ? (projectsById.get(t.projectId)?.name || 'Project') : 'Inbox';

    const ids = byPriority.get(t.priority) || [];
    const idx = ids.indexOf(t.id);

    const reorder = mode === 'active'
      ? el('div', { class: 'row' },
        el('button', {
          type: 'button',
          class: 'iconBtn',
          'aria-label': 'Move up',
          disabled: idx <= 0,
          onClick: () => onMoveUp?.(t)
        }, '↑'),
        el('button', {
          type: 'button',
          class: 'iconBtn',
          'aria-label': 'Move down',
          disabled: idx < 0 || idx >= ids.length - 1,
          onClick: () => onMoveDown?.(t)
        }, '↓')
      )
      : null;

    const right = el('div', { class: 'stack' },
      el('button', { type: 'button', class: 'iconBtn', 'aria-label': 'Edit', onClick: () => onEdit?.(t) }, '✎'),
      mode === 'active'
        ? el('button', { type: 'button', class: 'iconBtn', 'aria-label': 'Move', onClick: () => onMove?.(t) }, '⇄')
        : el('button', { type: 'button', class: 'iconBtn', 'aria-label': 'Restore', onClick: () => onRestore?.(t) }, '↩'),
      mode === 'active'
        ? el('button', { type: 'button', class: 'iconBtn', 'aria-label': 'Archive', onClick: () => onArchive?.(t) }, '⤓')
        : el('button', { type: 'button', class: 'iconBtn', 'aria-label': 'Delete', onClick: () => onDelete?.(t) }, '🗑')
    );

    const item = el('div', { class: 'todo' },
      el('input', {
        type: 'checkbox',
        'aria-label': `Mark ${t.title} completed`,
        checked: t.completed ? 'checked' : null,
        onChange: (e) => onToggleCompleted?.(t, e.target.checked)
      }),
      el('div', {},
        el('div', { class: t.completed ? 'todo__title todo__title--done' : 'todo__title' }, t.title),
        el('div', { class: 'todo__meta' },
          priorityBadge(t.priority),
          due ? el('span', {}, `Due ${due}`) : null,
          el('span', {}, projectName)
        ),
        reorder
      ),
      right
    );

    list.appendChild(item);
  }

  return list;
}
