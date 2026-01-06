import { el, clear } from '../ui/dom.js';

export function renderHelp(ctx) {
  const { main } = ctx;
  clear(main);

  const section = (title, content) => el('div', { class: 'card stack' },
    el('div', { style: 'font-weight: 700; font-size: 16px; margin-bottom: 4px;' }, title),
    el('div', { style: 'line-height: 1.5; color: var(--muted);', innerHTML: content })
  );

  const container = el('div', { class: 'stack' },
    el('div', { style: 'text-align: center; padding: 20px 0;' },
      el('div', { style: 'font-size: 40px; margin-bottom: 10px;' }, '💡'),
      el('div', { style: 'font-weight: 800; font-size: 24px;' }, 'How to use'),
      el('div', { style: 'color: var(--muted);' }, 'Master your productivity')
    ),

    section('📥 Inbox & Quick Capture', 
      'The Inbox is your landing zone. Tap the + button to quickly add tasks. Don\'t worry about organizing them yet—just get them out of your head.'
    ),

    section('📂 Projects & Checklists', 
      'Create Projects to organize related tasks. You can also create "Checklist" projects for simple lists (like groceries) where items are simpler and easier to add.'
    ),

    section('🔒 Protected Items', 
      'Toggle <b>"Protect"</b> in the editor to lock important tasks or projects. <br><br>' +
      'Protected items cannot be deleted or auto-archived until you unprotect them. They are marked with a lock icon.'
    ),

    section('⚡ Gestures & Shortcuts', 
      '• <b>Double-tap</b> anywhere in a Checklist project to quickly add a new item.<br>' +
      '• <b>Long-press</b> on a date header in the Archive to delete that entire day\'s group.<br>' +
      '• <b>Drag & Drop</b> tasks to reorder them within the same priority group.<br>' +
      '• <b>Drag & Drop</b> projects on the main screen to reorder them.'
    ),

    section('✅ Completion & Archive', 
      'When you complete a task, it stays visible for a moment, then moves to the "Completed" stack at the bottom. <br><br>' +
      'After <b>24 hours</b>, completed tasks are automatically moved to the <b>Archive</b>. They are grouped by date so you can see what you accomplished each day.'
    ),

    section('🗑️ Bin & Restoration', 
      'If you delete a task or an archived group, it goes to the <b>Bin</b>. <br><br>' +
      'Items in the Bin are kept for <b>24 hours</b> before being permanently deleted. You can restore them from Settings or the 🗑️ icon in the Archive.'
    ),

    section('🔥 Priorities', 
      'Use priorities (Urgent!, Highest, High, Medium, Low). <br><br>' +
      '<b>Urgent!</b> items flash rapidly to grab attention. <b>Highest</b> priority items are marked red.'
    ),

    el('div', { style: 'height: 40px;' }) // Spacer
  );

  main.append(container);
}
