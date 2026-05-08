export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style') {
      if (typeof v === 'string') node.style.cssText = v;
      else Object.assign(node.style, v);
    }
    else if (k === 'innerHTML') node.innerHTML = v;
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
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function toIsoDateOrNull(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function humanDue(isoOrNull) {
  if (!isoOrNull) return null;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return null;
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const h = d.getHours(), m = d.getMinutes();
  if (h !== 0 || m !== 0) {
    const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  }
  return dateStr;
}

export function emptyState(title, message) {
  return el('div', { class: 'emptyState' },
    el('div', { class: 'emptyState__icon' }, '📋'),
    el('div', { class: 'emptyState__title' }, title),
    el('div', { class: 'emptyState__message' }, message)
  );
}

