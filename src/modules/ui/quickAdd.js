import { el } from './dom.js';
import { t } from '../utils/i18n.js';

/**
 * Create the floating "+" button — exact replica of topbar__addBtn.
 * Opens the same inbox add menu. Only visible on the inbox page.
 * Long-press (500ms) opens Smart Add with microphone on (if enabled in settings).
 */
export function createQuickAddButton(ctx) {
  const { modalHost } = ctx;
  let longPressTimer = null;
  let isLongPress = false;
  const LONG_PRESS_MS = 500;

  const btn = el('button', {
    class: 'quickAdd-btn',
    type: 'button',
    'aria-label': t('addTask'),
    onClick: () => {
      if (isLongPress) {
        isLongPress = false; // Reset for next press
        return;
      }
      if (ctx.openInboxAddMenu) {
        ctx.openInboxAddMenu(modalHost);
      }
    }
  }, '+');

  // Shared long-press start handler
  function onPressStart(e) {
    // Only handle primary button / touch
    if (e.type === 'mousedown' && e.button !== 0) return;
    isLongPress = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(async () => {
      isLongPress = true;
      try {
        const settings = await ctx.db.settings.get();
        if (settings.quickVoiceAdd && settings.aiEnabled && settings.aiApiKey) {
          ctx.openSmartAdd({ mode: 'inbox', startMic: true });
        }
      } catch {
        // If settings check fails, do nothing
      }
    }, LONG_PRESS_MS);
  }

  function onPressEnd() {
    clearTimeout(longPressTimer);
  }

  btn.addEventListener('mousedown', onPressStart);
  btn.addEventListener('mouseup', onPressEnd);
  btn.addEventListener('mouseleave', onPressEnd);
  btn.addEventListener('touchstart', onPressStart, { passive: true });
  btn.addEventListener('touchend', onPressEnd);
  btn.addEventListener('touchcancel', onPressEnd);

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
