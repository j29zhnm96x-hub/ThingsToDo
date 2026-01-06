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
      'The Inbox is your landing zone for quick thoughts. Tap <b>+</b> to add tasks immediately.<br><br>' +
      '<b>Link to Inbox:</b> Working deep in a Project? Use the task menu ("...") to <b>Link to Inbox</b>. The task stays in the project but appears in your Inbox for focus. Tap the link icon (🔗) to jump to its project.'
    ),

    section('📂 Projects & Progress', 
      'Projects organize your work. The main list shows <b>Progress Bars</b> (Yellow for tasks, Purple for checklists) so you can see your status at a glance.<br><br>' +
      '<b>Sub-Projects:</b> Break large projects down! Inside a project, tap <b>+</b> then <b>New Sub-Project</b>. They appear at the top of the list.'
    ),

    section('⚡ Focus Mode (Zen)', 
      'When using a <b>Checklist</b> project (great for shopping or packing), tap the <b>⛶</b> icon in the header.<br><br>' +
      'This hides all navigation and lets you focus purely on the list. Great for when you are on the go!'
    ),

    section('🔒 Protected Items', 
      'Mark a task or project as <b>"Protected"</b> to prevent accidental deletion or archiving.<br><br>' +
      'Protected items have a lock icon (🔒) and must be unprotected before you can remove them. Perfect for grocery masters or recurring lists.'
    ),

    section('🔥 Priorities', 
      'Prioritize effectively with visual cues:<br>' +
      '• <b>Urgent!</b>: Flashes red. Do this NOW.<br>' +
      '• <b>Highest</b>: Solid red border.<br>' +
      '• <b>High/Medium/Low</b>: Colored indicators help you sort less critical work.'
    ),

    section('✅ Completion & Automation', 
      'Completed tasks move to the bottom stack. After <b>24 hours</b>, they are auto-archived by date.<br><br>' +
      '<b>Bin:</b> Deleted items stay in the Bin for 24 hours before vanishing forever.'
    ),

    section('👆 Gestures & Shortcuts', 
      '• <b>Double-tap</b> in a Checklist to quick-add items.<br>' +
      '• <b>Drag & Drop</b> tasks to reorder them.<br>' +
      '• <b>Drag & Drop</b> projects to arrange your dashboard.'
    ),

    el('div', { style: 'height: 40px;' }) // Spacer
  );

  main.append(container);
}
