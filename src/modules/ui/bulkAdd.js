import { el } from './dom.js';
import { openModal } from './modal.js';
import { t } from '../utils/i18n.js';

function focusInput(input) {
  try {
    if (document.activeElement !== input) {
      input.focus();
      if (document.activeElement !== input) input.click();
    }
  } catch {
    // Ignore focus failures on restrictive mobile browsers.
  }
}

export function parseBulkAddText(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return [];

  const parts = (!text.includes('\n') && text.includes(','))
    ? text.split(',')
    : text.split(/\r?\n/);

  return parts
    .map((part) => part.trim())
    .filter(Boolean);
}

// Parse bulk add text and optionally extract a leading page/name header.
// Returns { pageName: string|null, items: string[] }
export function parseBulkAddTextWithPage(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return { pageName: null, items: [] };

  const stripQuotes = (s) => {
    let v = String(s || '').trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1).trim();
    }
    return v;
  };

  let pageName = null;
  let itemsText = text;

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length > 1) {
    // First line might be a quoted name, or a name with trailing colon, or simply the page title
    const first = lines[0];
    const quoted = first.match(/^\s*"(.+)"\s*$|^\s*'(.+)'\s*$/);
    if (quoted) {
      pageName = quoted[1] || quoted[2];
      itemsText = lines.slice(1).join('\n');
    } else if (first.endsWith(':')) {
      pageName = first.slice(0, -1).trim();
      itemsText = lines.slice(1).join('\n');
    } else {
      // If first line is short and the rest look like items, treat it as page name
      if (first.length <= 60) {
        pageName = first;
        itemsText = lines.slice(1).join('\n');
      }
    }
  } else {
    // Single-line input: look for `Name: item, item` pattern
    const single = lines[0];
    const colonIndex = single.indexOf(':');
    if (colonIndex !== -1) {
      const possibleName = single.slice(0, colonIndex).trim();
      const rest = single.slice(colonIndex + 1).trim();
      if (possibleName.length > 0 && rest.length > 0) {
        pageName = stripQuotes(possibleName);
        itemsText = rest;
      }
    }
  }

  if (pageName) pageName = stripQuotes(pageName).trim();

  const parts = (!itemsText.includes('\n') && itemsText.includes(','))
    ? itemsText.split(',')
    : itemsText.split(/\r?\n/);

  const items = parts.map(p => p.trim()).filter(Boolean);

  return { pageName: pageName || null, items };
}

export function openBulkAddModal(modalHost, {
  title = t('addMultiple') || 'Add Multiple',
  label = 'Items',
  placeholder = t('bulkAddExampleItems') || 'milk\nbananas\nbread',
  submitLabel = t('addItems') || 'Add Items',
  passRaw = false,
  onSubmit
} = {}) {
  const input = el('textarea', {
    class: 'input textarea',
    rows: '6',
    placeholder,
    'aria-label': label,
    autocomplete: 'off',
    spellcheck: 'false'
  });

  const hint = el('div', { class: 'small' }, t('bulkAddHint') || 'Use one line per item, or commas in a single line.');
  const content = el('div', { class: 'stack' },
    el('label', { class: 'label' },
      el('span', {}, label),
      input
    ),
    hint
  );

  const submit = async () => {
    // If caller requested raw input handling, pass the full textarea value.
    if (typeof onSubmit === 'function' && submit.passRaw === true) {
      const raw = input.value;
      if (!raw || !raw.trim()) {
        focusInput(input);
        return false;
      }
      await onSubmit?.(raw);
      return true;
    }

    const items = parseBulkAddText(input.value);
    if (!items.length) {
      focusInput(input);
      return false;
    }
    await onSubmit?.(items);
    return true;
  };
  // expose flag on submit fn so callers can instruct it to deliver raw text
  submit.passRaw = !!passRaw;

  openModal(modalHost, {
    title,
    content,
    align: 'top',
    headerActions: [
      { label: submitLabel, class: 'btn btn--primary', onClick: submit }
    ],
    actions: [
      { label: t('cancel') || 'Cancel', class: 'btn btn--ghost', onClick: () => true },
      { label: submitLabel, class: 'btn btn--primary', onClick: submit }
    ]
  });

  focusInput(input);
  setTimeout(() => focusInput(input), 10);
  setTimeout(() => focusInput(input), 100);
}
