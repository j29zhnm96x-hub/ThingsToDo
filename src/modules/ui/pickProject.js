import { el } from './dom.js';
import { openModal } from './modal.js';

export async function pickProject(modalHost, { title, projects, includeInbox = true, initial = null, confirmLabel = 'Choose' }) {
  return new Promise((resolve) => {
    const select = el('select', { class: 'select', 'aria-label': 'Destination' });

    if (includeInbox) {
      select.appendChild(el('option', { value: '' }, 'Inbox'));
    }

    for (const p of projects) {
      select.appendChild(el('option', { value: p.id }, p.name));
    }

    if (initial != null) select.value = initial;

    const content = el('div', { class: 'stack' },
      el('label', { class: 'label' },
        el('span', {}, 'Destination'),
        select
      )
    );

    openModal(modalHost, {
      title,
      content,
      actions: [
        // Important: return `undefined` for Cancel so callers can distinguish
        // between Cancel and choosing Inbox (which is `null`).
        { label: 'Cancel', class: 'btn btn--ghost', onClick: () => (resolve(undefined), true) },
        {
          label: confirmLabel,
          class: 'btn btn--primary',
          onClick: () => {
            const v = select.value;
            resolve(v === '' ? null : v);
            return true;
          }
        }
      ]
    });
  });
}
