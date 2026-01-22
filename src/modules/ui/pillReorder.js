import { hapticLight } from './haptic.js';

const DEFAULTS = {
  longPressDelay: 300,
  moveThreshold: 10
};

function createGhost(pill, rect) {
  const ghost = pill.cloneNode(true);
  ghost.classList.add('pill-ghost');
  ghost.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 9999;
    margin: 0;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    transform: translateZ(0) scale(1.05);
    opacity: 0.95;
    box-shadow: 0 12px 32px rgba(0,0,0,0.3);
    will-change: transform;
  `;
  document.body.appendChild(ghost);
  return ghost;
}

function createPlaceholder(width, height) {
  const el = document.createElement('div');
  el.className = 'pill-placeholder';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.display = 'inline-block';
  el.style.flexShrink = '0';
  return el;
}

export function enablePillReorder(containerEl, { onPersistOrder, longPressDelay = DEFAULTS.longPressDelay, moveThreshold = DEFAULTS.moveThreshold } = {}) {
  let state = null;

  const cleanup = () => {
    if (!state) return;
    window.clearTimeout(state.timer);

    const { pill, ghost, placeholder, dragStarted, containerTouchAction } = state;

    // Restore pill
    if (pill) {
      pill.style.visibility = '';
      pill.dataset.dragging = 'false';
      pill.classList.remove('pill--dragging');
      pill.removeAttribute('aria-grabbed');
    }

    // Remove ghost
    if (ghost?.parentNode) {
      ghost.remove();
    }

    // Replace placeholder with pill or just remove it
    if (placeholder?.parentNode) {
      if (dragStarted && pill) {
        placeholder.parentNode.replaceChild(pill, placeholder);
      } else {
        placeholder.remove();
      }
    }

    // Restore container
    if (containerEl) {
      containerEl.style.touchAction = containerTouchAction || '';
    }

    state = null;
  };

  const startDrag = () => {
    if (!state || state.dragStarted) return;
    state.dragStarted = true;

    // Mark as dragging now that drag has actually started
    state.pill.dataset.dragging = 'true';

    const rect = state.pill.getBoundingClientRect();
    state.pillRect = rect;
    state.offsetX = state.startX - rect.left;

    // Create ghost and placeholder
    state.ghost = createGhost(state.pill, rect);
    state.placeholder = createPlaceholder(rect.width, rect.height);

    // Insert placeholder BEFORE the pill, then hide the pill
    state.pill.parentNode?.insertBefore(state.placeholder, state.pill);
    state.pill.style.visibility = 'hidden';
    state.pill.setAttribute('aria-grabbed', 'true');
    state.pill.classList.add('pill--dragging');

    // Lock container scrolling
    containerEl.style.touchAction = 'none';

    // Provide haptic feedback
    hapticLight();
  };

  const updateDrag = (clientX) => {
    if (!state?.dragStarted || !state.ghost || !state.placeholder) return;

    // Move ghost horizontally using transform for smoother animation
    const deltaX = clientX - state.startX;
    state.ghost.style.transform = `translateX(${deltaX}px) translateZ(0) scale(1.05)`;

    // Get all pills except the dragged one and placeholders
    const pills = Array.from(containerEl.querySelectorAll('.pill:not(.pill-placeholder)'))
      .filter((el) => el !== state.pill);

    // Find where to insert placeholder based on cursor position
    let insertBefore = null;
    for (const pill of pills) {
      const rect = pill.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (clientX < midpoint) {
        insertBefore = pill;
        break;
      }
    }

    // Move placeholder
    if (insertBefore && insertBefore !== state.placeholder.nextSibling) {
      containerEl.insertBefore(state.placeholder, insertBefore);
    } else if (!insertBefore && state.placeholder.nextSibling) {
      containerEl.appendChild(state.placeholder);
    }
  };

  const finishDrag = (persist) => {
    if (!state) return;

    const shouldPersist = persist && state.dragStarted;

    // Provide haptic feedback on drop
    if (state.dragStarted) {
      hapticLight();
    }

    cleanup();

    if (shouldPersist && typeof onPersistOrder === 'function') {
      // Query pills after cleanup has restored the pill to its new position
      const ids = Array.from(containerEl.querySelectorAll('.pill:not(.pill-placeholder)'))
        .map((p) => p.dataset.pageId)
        .filter(Boolean);
      if (ids.length) onPersistOrder(ids);
    }
  };

  const getEventCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const onStart = (e) => {
    if (state) return;

    const pill = e.currentTarget;
    const { clientX, clientY } = getEventCoords(e);

    // Save current touch-action
    const containerTouchAction = containerEl.style.touchAction || '';

    // Mark as in-progress (only when drag actually starts)
    // pill.dataset.dragging = 'true';  // Removed to allow double tap

    state = {
      pill,
      startX: clientX,
      startY: clientY,
      dragStarted: false,
      containerTouchAction,
      timer: null,
      ghost: null,
      placeholder: null,
      pillRect: null,
      offsetX: 0
    };

    // Start long-press timer
    state.timer = window.setTimeout(() => {
      if (state && !state.dragStarted) {
        state.pill.dataset.reordering = 'true';
        startDrag();
      }
    }, longPressDelay);
  };

  const onMove = (e) => {
    if (!state) return;

    const { clientX, clientY } = getEventCoords(e);
    const dx = clientX - state.startX;
    const dy = clientY - state.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!state.dragStarted) {
      // Moved too much before long-press completed - cancel
      if (dist > moveThreshold) {
        window.clearTimeout(state.timer);
        state.pill.dataset.dragging = 'false';
        state.pill.dataset.reordering = 'false';
        state = null;
      }
      return;
    }

    // We're dragging - prevent default and update
    e.preventDefault();
    e.stopPropagation();
    updateDrag(clientX);
  };

  const onEnd = (e) => {
    if (!state) return;

    // If drag was started, stop propagation to prevent click/touchend handlers
    if (state.dragStarted) {
      e.preventDefault();
      e.stopPropagation();
    } else {
      state.pill.dataset.reordering = 'false';
    }

    finishDrag(true);
  };

  const attach = () => {
    if (typeof document === 'undefined' || !containerEl) return;

    const pills = Array.from(containerEl.querySelectorAll('.pill'));

    pills.forEach((pill) => {
      // Mouse events
      pill.addEventListener('mousedown', onStart);
      pill.addEventListener('mousemove', onMove);
      pill.addEventListener('mouseup', onEnd);

      // Touch events
      pill.addEventListener('touchstart', onStart, { passive: true });
      pill.addEventListener('touchmove', onMove, { passive: false });
      pill.addEventListener('touchend', onEnd, { passive: false });
    });
  };

  return { attach };
}
