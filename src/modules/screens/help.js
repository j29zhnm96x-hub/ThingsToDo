import { el, clear } from '../ui/dom.js';
import { t } from '../utils/i18n.js';

export function renderHelp(ctx) {
  const { main } = ctx;
  clear(main);

  let openIndex = -1;

  // Define all sections: icon, title key, content key, accent color
  const sections = [
    { icon: '📥', titleKey: 'helpInbox', contentKey: 'helpInboxContent', color: '#06b6d4' },
    { icon: '📂', titleKey: 'helpProjects', contentKey: 'helpProjectsContent', color: '#f59e0b' },
    { icon: '📝', titleKey: 'helpTaskEditor', contentKey: 'helpTaskEditorContent', color: '#0ea5e9' },
    { icon: '🗂️', titleKey: 'helpChecklists', contentKey: 'helpChecklistsContent', color: '#22c55e' },
    { icon: '📋', titleKey: 'helpBulkAdd', contentKey: 'helpBulkAddContent', color: '#10b981' },
    { icon: '✨', titleKey: 'helpSuggestions', contentKey: 'helpSuggestionsContent', color: '#8b5cf6' },
    { icon: '⚡', titleKey: 'helpFocusMode', contentKey: 'helpFocusModeContent', color: '#8b5cf6' },
    { icon: '🔒', titleKey: 'helpProtected', contentKey: 'helpProtectedContent', color: '#ef4444' },
    { icon: '🔥', titleKey: 'helpPriorities', contentKey: 'helpPrioritiesContent', color: '#f97316' },
    { icon: '✅', titleKey: 'helpCompletion', contentKey: 'helpCompletionContent', color: '#22c55e' },
    { icon: '👆', titleKey: 'helpGestures', contentKey: 'helpGesturesContent', color: '#ec4899' },
    { icon: '🎙️', titleKey: 'helpVoiceMemos', contentKey: 'helpVoiceMemosContent', color: '#14b8a6' },
    { icon: '🤖', titleKey: 'helpAISmartAdd', contentKey: 'helpAISmartAddContent', color: '#7c3aed' },
    { icon: '⚙️', titleKey: 'helpSettings', contentKey: 'helpSettingsContent', color: '#64748b' },
    { icon: '🔣', titleKey: 'helpTaskCardIcons', contentKey: 'helpTaskCardIconsContent', color: '#6b7280' },
    { icon: '🖼️', titleKey: 'helpImageGallery', contentKey: 'helpImageGalleryContent', color: '#a855f7' },
    { icon: '📋', titleKey: 'helpChecklistItems', contentKey: 'helpChecklistItemsContent', color: '#22c55e' },
    { icon: '🗄️', titleKey: 'helpArchiveBin', contentKey: 'helpArchiveBinContent', color: '#64748b' },
    { icon: '📤', titleKey: 'helpSharing', contentKey: 'helpSharingContent', color: '#0ea5e9' },
    { icon: '💾', titleKey: 'helpDataManagement', contentKey: 'helpDataManagementContent', color: '#64748b' },
    { icon: '📲', titleKey: 'helpUpdates', contentKey: 'helpUpdatesContent', color: '#22c55e' },
    { icon: '📊', titleKey: 'helpStats', contentKey: 'helpStatsContent', color: '#8b5cf6' }
  ];

  // Search input
  const searchInput = el('input', {
    class: 'input',
    type: 'text',
    placeholder: t('helpSearch'),
    style: { width: '100%', marginBottom: '8px', padding: '12px', borderRadius: '12px', boxSizing: 'border-box' }
  });

  // Build accordion sections
  const sectionEls = sections.map((s, i) => {
    const contentEl = el('div', {
      style: 'display: none; line-height: 1.6; color: var(--muted); font-size: 14px; padding-top: 10px;',
      innerHTML: t(s.contentKey)
    });

    const arrow = el('span', { style: 'font-size: 12px; transition: transform 0.2s; flexShrink: 0' }, '▶');

    const header = el('div', {
      style: 'display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; padding: 4px 0;',
      onClick: () => toggleSection(i)
    },
      el('span', { style: 'font-size: 22px; flexShrink: 0' }, s.icon),
      el('span', { style: 'font-weight: 700; font-size: 16px; flex: 1; min-width: 0' }, t(s.titleKey)),
      arrow
    );

    // Background watermark (positioned fully off-card to avoid overlapping header)
    const watermark = el('div', {
      style: 'position: absolute; top: -40px; right: -30px; font-size: 72px; opacity: 0.05; pointer-events: none;'
    }, s.icon);

    const card = el('div', {
      class: 'card',
      style: `border-left: 4px solid ${s.color}; position: relative; overflow: hidden;`
    },
      watermark,
      header,
      contentEl
    );

    return { card, contentEl, arrow };
  });

  function toggleSection(idx) {
    if (openIndex === idx) {
      // Close current
      sectionEls[idx].contentEl.style.display = 'none';
      sectionEls[idx].arrow.textContent = '▶';
      openIndex = -1;
    } else {
      // Close previous if any
      if (openIndex >= 0) {
        sectionEls[openIndex].contentEl.style.display = 'none';
        sectionEls[openIndex].arrow.textContent = '▶';
      }
      // Open new
      sectionEls[idx].contentEl.style.display = '';
      sectionEls[idx].arrow.textContent = '▼';
      openIndex = idx;
    }
  }

  // Search filtering: match against title + content plain text
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();

    // Close open section when searching
    if (openIndex >= 0) {
      sectionEls[openIndex].contentEl.style.display = 'none';
      sectionEls[openIndex].arrow.textContent = '▶';
      openIndex = -1;
    }

    sectionEls.forEach((se, i) => {
      if (!q) {
        se.card.style.display = '';
        return;
      }
      const title = t(sections[i].titleKey).toLowerCase();
      // Strip HTML for content matching
      const content = t(sections[i].contentKey).replace(/<[^>]*>/g, '').toLowerCase();
      const match = title.includes(q) || content.includes(q);
      se.card.style.display = match ? '' : 'none';
    });
  });

  const container = el('div', { class: 'stack' },
    // Hero section (unchanged)
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
      el('div', { style: 'color: var(--muted); font-size: 15px; margin-bottom: 16px;' }, t('masterProductivity')),
      searchInput
    ),

    ...sectionEls.map(se => se.card),

    el('div', { style: 'height: 40px;' }) // Spacer
  );

  main.append(container);
}
