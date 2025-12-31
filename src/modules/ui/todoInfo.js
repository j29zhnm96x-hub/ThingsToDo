import { el } from './dom.js';
import { openModal } from './modal.js';

const PRIORITY_LABELS = {
  P0: 'Highest',
  P1: 'High',
  P2: 'Medium',
  P3: 'Low'
};

const PRIORITY_COLORS = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#22c55e'
};

function formatDate(isoOrNull) {
  if (!isoOrNull) return null;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function daysLeft(isoOrNull) {
  if (!isoOrNull) return null;
  const due = new Date(isoOrNull);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  // Reset time to compare dates only
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function daysLeftText(isoOrNull) {
  const days = daysLeft(isoOrNull);
  if (days === null) return null;
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days} days left`;
}

function daysLeftClass(isoOrNull) {
  const days = daysLeft(isoOrNull);
  if (days === null) return '';
  if (days < 0) return 'dueTag--overdue';
  if (days === 0) return 'dueTag--today';
  if (days <= 2) return 'dueTag--soon';
  return '';
}

export async function openTodoInfo({ todo, db, modalHost, onEdit }) {
  // Load attachments
  const attachments = await db.attachments.listForTodo(todo.id);
  const objectUrls = [];

  const priorityLabel = PRIORITY_LABELS[todo.priority] || todo.priority;
  const priorityColor = PRIORITY_COLORS[todo.priority] || '#6b7280';

  const dueDateFormatted = formatDate(todo.dueDate);
  const daysLeftStr = daysLeftText(todo.dueDate);
  const daysLeftCls = daysLeftClass(todo.dueDate);

  // Title with completion status
  const titleEl = el('div', { class: 'todoInfo__title' },
    todo.completed ? '✓ ' : '',
    todo.title
  );
  if (todo.completed) titleEl.style.textDecoration = 'line-through';

  // Priority badge
  const priorityEl = el('div', { class: 'todoInfo__row' },
    el('span', { class: 'todoInfo__label' }, 'Priority'),
    el('span', { class: 'todoInfo__value', style: { color: priorityColor, fontWeight: '700' } }, priorityLabel)
  );

  // Due date
  const dueDateEl = dueDateFormatted
    ? el('div', { class: 'todoInfo__row' },
        el('span', { class: 'todoInfo__label' }, 'Due date'),
        el('div', { class: 'todoInfo__value' },
          el('span', {}, dueDateFormatted),
          daysLeftStr ? el('span', { class: `dueTag ${daysLeftCls}` }, daysLeftStr) : null
        )
      )
    : null;

  // Notes
  const notesEl = todo.notes
    ? el('div', { class: 'todoInfo__section' },
        el('div', { class: 'todoInfo__label' }, 'Notes'),
        el('div', { class: 'todoInfo__notes' }, todo.notes)
      )
    : null;

  // Images
  let imagesEl = null;
  if (attachments.length > 0) {
    const thumbs = attachments.map((att) => {
      const url = URL.createObjectURL(att.blob);
      objectUrls.push(url);
      return el('div', { 
        class: 'thumb thumb--clickable',
        onClick: () => openImageViewer(url, att.name || 'Image')
      },
        el('img', { src: url, alt: att.name || 'Attachment' })
      );
    });
    imagesEl = el('div', { class: 'todoInfo__section' },
      el('div', { class: 'todoInfo__label' }, 'Images'),
      el('div', { class: 'thumbGrid' }, ...thumbs)
    );
  }

  function openImageViewer(url, name) {
    const overlay = el('div', { class: 'imageViewer', onClick: (e) => {
      if (e.target === overlay) overlay.remove();
    }},
      el('button', { 
        class: 'imageViewer__close', 
        type: 'button',
        'aria-label': 'Close',
        onClick: () => overlay.remove()
      }, '×'),
      el('img', { 
        class: 'imageViewer__img', 
        src: url, 
        alt: name,
        onClick: (e) => e.stopPropagation()
      })
    );
    document.body.appendChild(overlay);
  }

  // Status
  const statusEl = el('div', { class: 'todoInfo__row' },
    el('span', { class: 'todoInfo__label' }, 'Status'),
    el('span', { class: 'todoInfo__value' }, todo.completed ? 'Completed' : 'Active')
  );

  const content = el('div', { class: 'stack' },
    titleEl,
    el('div', { class: 'hr' }),
    priorityEl,
    statusEl,
    dueDateEl,
    notesEl,
    imagesEl
  );

  openModal(modalHost, {
    title: 'Todo Details',
    content,
    actions: [
      { label: 'Edit', class: 'btn', onClick: () => { onEdit?.(todo); return true; } },
      { label: 'Close', class: 'btn btn--primary', onClick: () => true }
    ],
    onClose: () => {
      // Revoke object URLs
      for (const u of objectUrls) URL.revokeObjectURL(u);
    }
  });
}

// Export helper for use in todoList
export { daysLeftText, daysLeftClass };
