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

export function openBulkAddModal(modalHost, {
  title = t('addMultiple') || 'Add Multiple',
  label = 'Items',
  placeholder = t('bulkAddExampleItems') || 'milk\nbananas\nbread',
  submitLabel = t('addItems') || 'Add Items',
  onSubmit
}) {
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
    const items = parseBulkAddText(input.value);
    if (!items.length) {
      focusInput(input);
      return false;
    }
    await onSubmit?.(items);
    return true;
  };

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