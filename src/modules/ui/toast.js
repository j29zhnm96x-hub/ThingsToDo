import { el } from './dom.js';

// Simple toast notification system
// Shows temporary success/info messages that fade out automatically

let toastContainer = null;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = el('div', { class: 'toastContainer', 'aria-live': 'polite', 'aria-atomic': 'true' });
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, { duration = 2500, type = 'success' } = {}) {
  const container = ensureContainer();
  
  const toast = el('div', { 
    class: `toast toast--${type}`,
    role: 'status',
    'aria-live': 'polite'
  }, message);
  
  container.appendChild(toast);
  
  // Trigger animation by forcing reflow
  toast.offsetHeight;
  toast.classList.add('toast--show');
  
  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('toast--show');
    toast.classList.add('toast--hide');
    
    // Remove from DOM after animation
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}
