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
 * Visible on inbox and projects pages, respects enableQuickAdd setting.
 */
export async function updateQuickAddButton(btn, db, routeGroup) {
  if (!btn || !db) return;
  if (routeGroup !== 'inbox' && routeGroup !== 'projects') {
    btn.style.display = 'none';
    return;
  }
  const settings = await db.settings.get();
  btn.style.display = settings.enableQuickAdd !== false ? '' : 'none';
}
