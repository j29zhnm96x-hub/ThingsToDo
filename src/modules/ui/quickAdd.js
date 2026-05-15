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
 * Show/hide the quick add button.
 * Visible on inbox and projects pages — always shown there.
 */
export function updateQuickAddButton(btn, routeGroup, routeName) {
  if (!btn) return;
  // Hide on individual project detail pages (has its own + button)
  if (routeName === 'project') {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = (routeGroup === 'inbox' || routeGroup === 'projects') ? '' : 'none';
}
