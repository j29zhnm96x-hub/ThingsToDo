import { el } from './dom.js';
import { openModal } from './modal.js';

export function confirm(modalHost, { title = 'Confirm', message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    const content = el('div', { class: 'stack' },
      el('div', { class: 'small' }, message || 'Are you sure?')
    );

    openModal(modalHost, {
      title,
      content,
      actions: [
        { label: 'Cancel', class: 'btn btn--ghost', onClick: () => (resolve(false), true) },
        { label: confirmLabel, class: danger ? 'btn btn--danger' : 'btn btn--primary', onClick: () => (resolve(true), true) }
      ]
    });
  });
}
