import { el } from './dom.js';
import { openModal } from './modal.js';

// Simple action menu opened from the "..." button on a todo card.
export function openTodoMenu(modalHost, { title = 'Todo', actions = [], db }) {
  const content = el('div', { class: 'small' }, '');

  // Note: Share button is injected by callers when they construct actions so we keep this simple.

  openModal(modalHost, {
    title,
    content,
    actions: [
      ...actions,
      { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true }
    ]
  });
}
