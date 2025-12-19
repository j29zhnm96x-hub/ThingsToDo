// Theme handling kept intentionally small.
// We use a single `data-theme` attribute on <html> so CSS variables can swap.

export function applyTheme(theme) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
}
