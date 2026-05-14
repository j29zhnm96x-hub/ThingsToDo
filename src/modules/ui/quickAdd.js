// Quick Add with Natural Language Parsing
// "Buy milk tomorrow at 3pm priority high" → title + dueDate + priority

import { el } from './dom.js';
import { openModal } from './modal.js';
import { newTodo, Priority } from '../data/models.js';
import { t } from '../utils/i18n.js';
import { router } from '../router.js';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function parseNLP(text) {
  let remaining = text.trim();
  if (!remaining) return null;

  let priority = Priority.P2; // default medium
  let dueDate = null;
  let timeStr = null;

  // Priority detection
  const priorityPatterns = [
    { re: /\b(urgent|!!!)\b/i, priority: Priority.URGENT },
    { re: /\b(p0|highest)\b/i, priority: Priority.P0 },
    { re: /\b(p1|high priority|priority high)\b/i, priority: Priority.P1 },
    { re: /\b(p2|medium priority|priority medium)\b/i, priority: Priority.P2 },
    { re: /\b(p3|low priority|priority low)\b/i, priority: Priority.P3 },
  ];
  for (const { re, priority: p } of priorityPatterns) {
    if (re.test(remaining)) {
      priority = p;
      remaining = remaining.replace(re, '').trim();
      break;
    }
  }

  // Time detection (e.g. "at 3pm", "3pm", "at 15:00", "15:00")
  const timeMatch = remaining.match(/\b(at\s+)?(\d{1,2})(:(\d{2}))?\s*(pm|am)?\b/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[2], 10);
    const mins = timeMatch[4] ? parseInt(timeMatch[4], 10) : 0;
    const ampm = (timeMatch[5] || '').toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    timeStr = { hours, minutes: mins };
    remaining = remaining.replace(timeMatch[0], '').trim();
  }

  // Date detection
  const lower = remaining.toLowerCase();

  // "today"
  if (/\btoday\b/.test(lower)) {
    dueDate = new Date();
    remaining = remaining.replace(/\btoday\b/i, '').trim();
  }
  // "tomorrow"
  else if (/\btomorrow\b/.test(lower)) {
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    remaining = remaining.replace(/\btomorrow\b/i, '').trim();
  }
  // "next monday", "next tuesday", etc.
  else if (/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lower)) {
    const dayMatch = lower.match(/\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    const targetDay = DAY_NAMES.indexOf(dayMatch[1].toLowerCase());
    const today = new Date();
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysUntil);
    remaining = remaining.replace(dayMatch[0], '').trim();
  }
  // "monday", "tuesday" (next occurrence)
  else if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lower)) {
    const dayMatch = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
    const targetDay = DAY_NAMES.indexOf(dayMatch[1].toLowerCase());
    const today = new Date();
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysUntil);
    remaining = remaining.replace(dayMatch[0], '').trim();
  }
  // "next week"
  else if (/\bnext\s+week\b/i.test(lower)) {
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    remaining = remaining.replace(/\bnext\s+week\b/i, '').trim();
  }

  // Combine date + time
  if (dueDate && timeStr) {
    dueDate.setHours(timeStr.hours, timeStr.minutes, 0, 0);
  } else if (dueDate) {
    dueDate.setHours(23, 59, 0, 0); // end of day if no time
  }

  // Clean up remaining text
  const title = remaining.replace(/\s+/g, ' ').trim();

  return { title, priority, dueDate: dueDate ? dueDate.toISOString() : null };
}

export function openQuickAddModal({ db, modalHost }) {
  const input = el('textarea', {
    class: 'input input--title',
    placeholder: t('quickAddPlaceholder'),
    'aria-label': t('quickAdd'),
    rows: 2,
    autocomplete: 'off'
  });

  const hint = el('div', { class: 'small', style: 'color: var(--muted); margin-top: 4px;' }, t('quickAddHint'));

  const content = el('div', { class: 'stack' }, input, hint);

  const addTask = async () => {
    const raw = input.value.trim();
    if (!raw) return false;

    const parsed = parseNLP(raw);
    if (!parsed || !parsed.title) return false;

    const todo = newTodo({ title: parsed.title, projectId: null });
    todo.priority = parsed.priority;
    todo.dueDate = parsed.dueDate;

    await db.todos.put(todo);
    await router.refresh();
    return true;
  };

  openModal(modalHost, {
    title: t('quickAdd'),
    content,
    align: 'top',
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true },
      { label: t('add'), class: 'btn btn--primary', onClick: addTask }
    ]
  });

  // Focus the input
  const focus = () => { try { input.focus(); } catch {} };
  setTimeout(focus, 100);
  setTimeout(focus, 300);
}

/**
 * Create and manage the floating "+" button.
 * Shows/hides based on settings.enableQuickAdd.
 */
export function createQuickAddButton(ctx) {
  const { db, modalHost } = ctx;
  const btn = el('button', {
    class: 'quickAdd-btn',
    type: 'button',
    'aria-label': t('quickAdd'),
    onClick: () => {
      openQuickAddModal({ db, modalHost });
    }
  }, '+');
  return btn;
}

/**
 * Show/hide the quick add button based on current settings.
 */
export async function updateQuickAddButton(btn) {
  if (!btn) return;
  const settings = await db.settings.get();
  btn.style.display = settings.enableQuickAdd !== false ? '' : 'none';
}
