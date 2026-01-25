import { el, clear } from '../ui/dom.js';
import { t } from '../utils/i18n.js';

export function renderHelp(ctx) {
  const { main } = ctx;
  clear(main);

  const section = (icon, title, content, accentColor) => el('div', { 
    class: 'card stack',
    style: `border-left: 4px solid ${accentColor}; position: relative; overflow: hidden;`
  },
    el('div', { 
      style: `position: absolute; top: -20px; right: -20px; font-size: 80px; opacity: 0.06; pointer-events: none;` 
    }, icon),
    el('div', { style: 'display: flex; align-items: center; gap: 10px; margin-bottom: 6px;' },
      el('span', { style: 'font-size: 22px;' }, icon),
      el('span', { style: 'font-weight: 700; font-size: 16px;' }, title)
    ),
    el('div', { style: 'line-height: 1.6; color: var(--muted); font-size: 14px;', innerHTML: content })
  );

  const container = el('div', { class: 'stack' },
    // Hero section
    el('div', { 
      style: `
        text-align: center; 
        padding: 40px 20px; 
        background: linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%);
        border-radius: var(--radius);
        border: 1px solid var(--border);
        margin-bottom: 8px;
        position: relative;
        overflow: hidden;
      ` 
    },
      el('div', { 
        style: `
          position: absolute; 
          top: 50%; 
          left: 50%; 
          transform: translate(-50%, -50%);
          width: 200px;
          height: 200px;
          background: radial-gradient(circle, var(--glow) 0%, transparent 70%);
          pointer-events: none;
        `
      }),
      el('div', { 
        style: `
          font-size: 56px; 
          margin-bottom: 16px;
          filter: drop-shadow(0 4px 20px var(--glow));
        ` 
      }, '💡'),
      el('div', { 
        style: `
          font-weight: 800; 
          font-size: 28px;
          background: linear-gradient(135deg, var(--text) 0%, var(--accent) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        ` 
      }, t('howToUse')),
      el('div', { style: 'color: var(--muted); font-size: 15px;' }, t('masterProductivity'))
    ),

    section('📥', t('helpInbox'), t('helpInboxContent'), '#06b6d4'),
    section('📂', t('helpProjects'), t('helpProjectsContent'), '#f59e0b'),
    section('🗂️', t('helpChecklists'), t('helpChecklistsContent'), '#22c55e'),
    section('✨', t('helpSuggestions'), t('helpSuggestionsContent'), '#8b5cf6'),
    section('⚡', t('helpFocusMode'), t('helpFocusModeContent'), '#8b5cf6'),
    section('🔒', t('helpProtected'), t('helpProtectedContent'), '#ef4444'),
    section('🔥', t('helpPriorities'), t('helpPrioritiesContent'), '#f97316'),
    section('✅', t('helpCompletion'), t('helpCompletionContent'), '#22c55e'),
    section('👆', t('helpGestures'), t('helpGesturesContent'), '#ec4899'),
    section('🎙️', t('helpVoiceMemos'), t('helpVoiceMemosContent'), '#14b8a6'),
    section('⚙️', t('helpSettings'), t('helpSettingsContent'), '#64748b'),
    section('💾', t('helpDataManagement'), t('helpDataManagementContent'), '#64748b'),

    el('div', { style: 'height: 40px;' }) // Spacer
  );

  main.append(container);
}
