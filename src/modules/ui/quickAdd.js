import { el } from './dom.js';
import { t } from '../utils/i18n.js';

/**
 * Create the floating "+" button — exact replica of topbar__addBtn.
 * Opens the same inbox add menu. Only visible on the inbox page.
 */
export function createQuickAddButton(ctx) {
  const { modalHost } = ctx;
  const btn = el('button', {
    class: 'quickAdd-btn',
    type: 'button',
    'aria-label': t('addTask'),
    onClick: () => {
      if (ctx.openInboxAddMenu) {
        ctx.openInboxAddMenu(modalHost);
      }
    }
  }, '+');
  return btn;
}

/**
 * Show/hide the floating + button.
 * Only visible on the inbox page.
 */
export function updateQuickAddButton(btn, routeGroup, routeName) {
  if (!btn) return;
  btn.style.display = routeName === 'inbox' ? '' : 'none';
}
