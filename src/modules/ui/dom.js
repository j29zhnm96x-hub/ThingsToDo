export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === false || v == null) {
      // skip
    } else node.setAttribute(k, String(v));
  }

  for (const child of children.flat()) {
    if (child == null) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }

  return node;
}

export function clear(node) {
  node.innerHTML = '';
}

export function formatDateInput(isoOrNull) {
  if (!isoOrNull) return '';
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function toIsoDateOrNull(dateStr) {
  if (!dateStr) return null;
  // Store as midnight local time ISO string (good enough for a personal todo list)
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function humanDue(isoOrNull) {
  if (!isoOrNull) return null;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function emptyState(title, message) {
  return el('div', { class: 'emptyState' },
    el('div', { class: 'emptyState__icon' }, '📋'),
    el('div', { class: 'emptyState__title' }, title),
    el('div', { class: 'emptyState__message' }, message)
  );
}

