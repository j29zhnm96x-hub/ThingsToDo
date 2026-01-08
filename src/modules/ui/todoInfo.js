import { el } from './dom.js';
import { openModal } from './modal.js';

const PRIORITY_LABELS = {
  P0: 'Highest',
  P1: 'High',
  P2: 'Medium',
  P3: 'Low'
};

const PRIORITY_COLORS = {
  P0: '#ef4444',
  P1: '#f97316',
  P2: '#eab308',
  P3: '#22c55e'
};

function formatDate(isoOrNull) {
  if (!isoOrNull) return null;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function daysLeft(isoOrNull) {
  if (!isoOrNull) return null;
  const due = new Date(isoOrNull);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  // Reset time to compare dates only
  due.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function daysLeftText(isoOrNull) {
  const days = daysLeft(isoOrNull);
  if (days === null) return null;
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `${days} days left`;
}

function daysLeftClass(isoOrNull) {
  const days = daysLeft(isoOrNull);
  if (days === null) return '';
  if (days < 0) return 'dueTag--overdue';
  if (days === 0) return 'dueTag--today';
  if (days <= 3) return 'dueTag--soon';
  return '';
}

export async function openTodoInfo({ todo, db, modalHost, onEdit }) {
  // Load attachments
  const attachments = await db.attachments.listForTodo(todo.id);
  const objectUrls = [];

  const priorityLabel = PRIORITY_LABELS[todo.priority] || todo.priority;
  const priorityColor = PRIORITY_COLORS[todo.priority] || '#6b7280';

  const dueDateFormatted = formatDate(todo.dueDate);
  const daysLeftStr = daysLeftText(todo.dueDate);
  const daysLeftCls = daysLeftClass(todo.dueDate);

  // Title with completion status
  const titleEl = el('div', { class: 'todoInfo__title' },
    todo.completed ? '✓ ' : '',
    todo.title
  );
  if (todo.completed) titleEl.style.textDecoration = 'line-through';

  // Priority badge
  const priorityEl = el('div', { class: 'todoInfo__row' },
    el('span', { class: 'todoInfo__label' }, 'Priority'),
    el('span', { class: 'todoInfo__value', style: { color: priorityColor, fontWeight: '700' } }, priorityLabel)
  );

  // Due date
  const dueDateEl = dueDateFormatted
    ? el('div', { class: 'todoInfo__row' },
        el('span', { class: 'todoInfo__label' }, 'Due date'),
        el('div', { class: 'todoInfo__value' },
          el('span', {}, dueDateFormatted),
          daysLeftStr ? el('span', { class: `dueTag ${daysLeftCls}` }, daysLeftStr) : null
        )
      )
    : null;

  // Notes
  const notesEl = todo.notes
    ? el('div', { class: 'todoInfo__section' },
        el('div', { class: 'todoInfo__label' }, 'Notes'),
        el('div', { class: 'todoInfo__notes' }, todo.notes)
      )
    : null;

  // Images
  let imagesEl = null;
  const fullImageUrls = [];
  if (attachments.length > 0) {
    const thumbs = attachments.map((att, index) => {
      const thumbBlob = att.thumb || att.blob;
      const thumbUrl = URL.createObjectURL(thumbBlob);
      objectUrls.push(thumbUrl);

      let fullUrl = thumbUrl;
      if (thumbBlob !== att.blob) {
        fullUrl = URL.createObjectURL(att.blob);
        objectUrls.push(fullUrl);
      }
      fullImageUrls.push(fullUrl);

      return el('div', { 
        class: 'thumb thumb--clickable',
        onClick: () => openImageViewer(fullImageUrls, index)
      },
        el('img', { src: thumbUrl, alt: att.name || 'Attachment', loading: 'lazy', decoding: 'async' })
      );
    });
    imagesEl = el('div', { class: 'todoInfo__section' },
      el('div', { class: 'todoInfo__label' }, 'Images'),
      el('div', { class: 'thumbGrid' }, ...thumbs)
    );
  }

  function openImageViewer(urls, startIndex) {
    let currentIndex = startIndex;
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let lastDistance = 0;
    let lastScale = 1;
    let lastX = 0, lastY = 0;
    let lastTranslateX = 0, lastTranslateY = 0;
    let activePointers = new Map();
    let swipeStartX = 0;
    let swipeStartY = 0;
    let isSwiping = false;

    const img = el('img', { 
      class: 'imageViewer__img', 
      src: urls[currentIndex], 
      alt: 'Image'
    });

    // Counter element (e.g., "1 / 3")
    const counter = el('div', { class: 'imageViewer__counter' }, 
      `${currentIndex + 1} / ${urls.length}`
    );

    function updateImage() {
      img.src = urls[currentIndex];
      counter.textContent = `${currentIndex + 1} / ${urls.length}`;
      // Reset zoom when changing images
      scale = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    }

    function nextImage() {
      if (currentIndex < urls.length - 1) {
        currentIndex++;
        updateImage();
      }
    }

    function prevImage() {
      if (currentIndex > 0) {
        currentIndex--;
        updateImage();
      }
    }

    function updateTransform() {
      img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    }

    function getDistance(p1, p2) {
      const dx = p1.clientX - p2.clientX;
      const dy = p1.clientY - p2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function getCenter(p1, p2) {
      return {
        x: (p1.clientX + p2.clientX) / 2,
        y: (p1.clientY + p2.clientY) / 2
      };
    }

    function handlePointerDown(e) {
      e.preventDefault();
      activePointers.set(e.pointerId, e);
      img.setPointerCapture(e.pointerId);

      if (activePointers.size === 2) {
        const pointers = Array.from(activePointers.values());
        lastDistance = getDistance(pointers[0], pointers[1]);
        lastScale = scale;
        isSwiping = false;
      } else if (activePointers.size === 1) {
        lastX = e.clientX;
        lastY = e.clientY;
        lastTranslateX = translateX;
        lastTranslateY = translateY;
        // Track for swipe when not zoomed
        if (scale === 1 && urls.length > 1) {
          swipeStartX = e.clientX;
          swipeStartY = e.clientY;
          isSwiping = true;
        }
      }
    }

    function handlePointerMove(e) {
      if (!activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, e);

      if (activePointers.size === 2) {
        const pointers = Array.from(activePointers.values());
        const currentDistance = getDistance(pointers[0], pointers[1]);
        
        if (lastDistance > 0) {
          const newScale = Math.min(5, Math.max(1, lastScale * (currentDistance / lastDistance)));
          scale = newScale;
          
          if (scale <= 1) {
            scale = 1;
            translateX = 0;
            translateY = 0;
          }
          updateTransform();
        }
      } else if (activePointers.size === 1) {
        if (scale > 1) {
          // Pan when zoomed
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          translateX = lastTranslateX + dx;
          translateY = lastTranslateY + dy;
          updateTransform();
        } else if (isSwiping && urls.length > 1) {
          // Preview swipe - show slight horizontal movement
          const dx = e.clientX - swipeStartX;
          img.style.transform = `translateX(${dx * 0.3}px)`;
        }
      }
    }

    function handlePointerUp(e) {
      // Check for swipe before clearing pointers
      if (isSwiping && scale === 1 && activePointers.size === 1 && urls.length > 1) {
        const dx = e.clientX - swipeStartX;
        const dy = e.clientY - swipeStartY;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        
        // Horizontal swipe threshold: 50px, and more horizontal than vertical
        if (absDx > 50 && absDx > absDy) {
          if (dx < 0) {
            nextImage();
          } else {
            prevImage();
          }
        } else {
          // Reset position if swipe wasn't far enough
          img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        }
        isSwiping = false;
      }

      activePointers.delete(e.pointerId);
      
      // Reset tracking when going from 2 to 1 pointer
      if (activePointers.size === 1) {
        const remaining = Array.from(activePointers.values())[0];
        lastX = remaining.clientX;
        lastY = remaining.clientY;
        lastTranslateX = translateX;
        lastTranslateY = translateY;
      }
      
      lastDistance = 0;
      lastScale = scale;
    }

    // Double tap to zoom
    let lastTap = 0;
    function handleDoubleTap(e) {
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
        if (scale > 1) {
          scale = 1;
          translateX = 0;
          translateY = 0;
        } else {
          scale = 2;
        }
        updateTransform();
      }
      lastTap = now;
    }

    // Pointer events on image
    img.addEventListener('pointerdown', handlePointerDown);
    img.addEventListener('pointermove', handlePointerMove);
    img.addEventListener('pointerup', handlePointerUp);
    img.addEventListener('pointercancel', handlePointerUp);
    img.addEventListener('click', handleDoubleTap);

    const closeBtn = el('button', { 
      class: 'imageViewer__close', 
      type: 'button',
      'aria-label': 'Close'
    }, '×');

    const overlay = el('div', { class: 'imageViewer' },
      closeBtn,
      urls.length > 1 ? counter : null,
      img
    );

    function closeViewer() {
      overlay.remove();
    }

    // Close button
    closeBtn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeViewer();
    });

    // Close on tap outside when not zoomed
    overlay.addEventListener('pointerup', (e) => {
      if (e.target === overlay && scale === 1) closeViewer();
    });

    document.body.appendChild(overlay);
  }

  // Status
  const statusEl = el('div', { class: 'todoInfo__row' },
    el('span', { class: 'todoInfo__label' }, 'Status'),
    el('span', { class: 'todoInfo__value' }, todo.completed ? 'Completed' : 'Active')
  );

  const content = el('div', { class: 'stack' },
    titleEl,
    el('div', { class: 'hr' }),
    priorityEl,
    statusEl,
    dueDateEl,
    notesEl,
    imagesEl
  );

  openModal(modalHost, {
    title: 'Todo Details',
    content,
    actions: [
      { label: 'Edit', class: 'btn', onClick: () => { onEdit?.(todo); return true; } },
      { label: 'Close', class: 'btn btn--primary', onClick: () => true }
    ],
    onClose: () => {
      // Revoke object URLs
      for (const u of objectUrls) URL.revokeObjectURL(u);
    }
  });
}

// Export helper for use in todoList
export { daysLeftText, daysLeftClass };
