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
 * Only visible on inbox page AND when enableQuickAdd setting is on.
 */
export async function updateQuickAddButton(btn, db, routeGroup) {
  if (!btn || !db) return;
  if (routeGroup !== 'inbox') {
    btn.style.display = 'none';
    return;
  }
  const settings = await db.settings.get();
  btn.style.display = settings.enableQuickAdd !== false ? '' : 'none';
}
