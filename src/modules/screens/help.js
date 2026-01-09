import { el, clear } from '../ui/dom.js';
import { t } from '../utils/i18n.js';

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
      el('div', { style: 'font-weight: 800; font-size: 24px;' }, t('howToUse')),
      el('div', { style: 'color: var(--muted);' }, t('masterProductivity'))
    ),

    section('📥 ' + t('helpInbox'), t('helpInboxContent')),
    section('📂 ' + t('helpProjects'), t('helpProjectsContent')),
    section('⚡ ' + t('helpFocusMode'), t('helpFocusModeContent')),
    section('🔒 ' + t('helpProtected'), t('helpProtectedContent')),
    section('🔥 ' + t('helpPriorities'), t('helpPrioritiesContent')),
    section('✅ ' + t('helpCompletion'), t('helpCompletionContent')),
    section('👆 ' + t('helpGestures'), t('helpGesturesContent')),

    el('div', { style: 'height: 40px;' }) // Spacer
  );

  main.append(container);
}
