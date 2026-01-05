import { el, clear } from './dom.js';
import { hapticLight } from './haptic.js';

// Simple bottom-sheet modal with focus management.

export function openModal(modalHost, { title, content, actions = [], onClose, align = 'bottom' }) {
  const previouslyFocused = document.activeElement;

  clear(modalHost);
  modalHost.setAttribute('aria-hidden', 'false');
  modalHost.dataset.align = align;
  document.body.style.overflow = 'hidden'; // Lock body scroll

  const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' });

  const header = el('div', { class: 'modal__header' },
    el('div', { class: 'modal__title' }, title || 'Dialog'),
    el('button', {
      type: 'button',
      class: 'iconBtn',
      'aria-label': 'Close',
      onClick: () => { hapticLight(); close(); }
    }, '×')
  );

  const body = el('div', { class: 'stack' }, content);

  const footer = el('div', { class: 'stack' },
    actions.map((a) => el('button', {
      type: 'button',
      class: a.class || 'btn',
      onClick: async () => {
        hapticLight();
        const shouldClose = await a.onClick?.();
        if (shouldClose !== false) close();
      }
    }, a.label))
  );

  modal.append(header, body, el('div', { class: 'hr' }), footer);
  modalHost.appendChild(modal);

  const focusables = () => Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter((n) => !n.hasAttribute('disabled'));

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function close() {
    document.body.style.overflow = ''; // Unlock body scroll
    modalHost.setAttribute('aria-hidden', 'true');
    clear(modalHost);
    modalHost.removeEventListener('keydown', onKeyDown);
    onClose?.();
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
  }

  modalHost.addEventListener('keydown', onKeyDown);

  // Click outside closes
  modalHost.addEventListener('click', (e) => {
    if (e.target === modalHost) close();
  }, { once: true });

  // Initial focus (synchronous to support mobile keyboard triggering)
  const f = focusables();
  (f[0] || modal).focus?.();

  return { close };
}
