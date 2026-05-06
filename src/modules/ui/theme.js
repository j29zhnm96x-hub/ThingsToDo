// Theme handling kept intentionally small.
// We use a single `data-theme` attribute on <html> so CSS variables can swap.

let mediaQuery = null;

function resolveTheme(theme) {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme === 'light' ? 'light' : 'dark';
}

function setTheme(t) {
  document.documentElement.dataset.theme = t;
}

export function applyTheme(theme) {
  if (mediaQuery) {
    mediaQuery.removeEventListener('change', mediaQuery._handler);
    mediaQuery = null;
  }
  if (theme === 'system') {
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery._handler = () => setTheme(resolveTheme('system'));
    mediaQuery.addEventListener('change', mediaQuery._handler);
  }
  setTheme(resolveTheme(theme));
}

export function applyPalette(palette) {
  const p = palette || 'default';
  document.documentElement.dataset.palette = p;
}
