import { el } from './dom.js';
import { openModal } from './modal.js';
import { t } from '../utils/i18n.js';

/**
 * Unified hierarchical destination picker.
 * Shows projects, sub-projects, and their checklist pages in an indented tree.
 * Returns { projectId, pageId } or undefined if cancelled.
 *
 * @param {HTMLElement} modalHost
 * @param {object} options
 * @param {Array} options.projects   - All projects from db.projects.list()
 * @param {Map}   options.pagesByProjectId - Map<projectId, Array<{id, name}>>
 * @param {object} options.initial
 * @param {string|null} options.initial.projectId
 * @param {string|null} options.initial.pageId
 * @param {boolean} options.includeInbox - Whether to show Inbox as destination
 * @returns {Promise<{projectId, pageId}|undefined>}
 */
export async function pickDestination(modalHost, {
  projects,
  pagesByProjectId = new Map(),
  initial = { projectId: null, pageId: null },
  includeInbox = true
} = {}) {
  return new Promise((resolve) => {
    const searchInput = el('input', {
      type: 'text',
      class: 'input',
      placeholder: t('search') || 'Search...',
      'aria-label': t('search') || 'Search',
      style: 'margin-bottom:8px'
    });

    const listEl = el('div', { class: 'list', style: 'max-height:60vh;overflow-y:auto' });

    let currentFilter = '';

    function buildTree(filter) {
      listEl.innerHTML = '';
      const lower = filter.toLowerCase();

      // Collect all items (projects + their pages) that match the filter
      const items = [];

      if (includeInbox) {
        items.push({
          type: 'inbox',
          projectId: null,
          pageId: null,
          label: t('inbox') || 'Inbox',
          labelLower: (t('inbox') || 'Inbox').toLowerCase(),
          indent: 0
        });
      }

      // Build parent map for hierarchy display
      const projMap = new Map(projects.map(p => [p.id, p]));

      // Function to get indentation level for a project (by parent depth)
      function getDepth(id, memo = new Map()) {
        if (memo.has(id)) return memo.get(id);
        const proj = projMap.get(id);
        if (!proj || !proj.parentId) { memo.set(id, 0); return 0; }
        const d = getDepth(proj.parentId, memo) + 1;
        memo.set(id, d);
        return d;
      }

      // Helper to build path string for a project
      function getPath(id) {
        const parts = [];
        let cur = projMap.get(id);
        while (cur) {
          parts.unshift(cur.name);
          cur = cur.parentId ? projMap.get(cur.parentId) : null;
        }
        return parts.join(' / ');
      }

      // Sort projects by hierarchy (parents before children, then by name)
      const sorted = [...projects].sort((a, b) => {
        const aPath = getPath(a.id).toLowerCase();
        const bPath = getPath(b.id).toLowerCase();
        return aPath.localeCompare(bPath);
      });

      for (const proj of sorted) {
        if (proj.type === 'checklist') {
          // For checklist projects, show the project as a header and pages as items
          const pages = (pagesByProjectId.get(proj.id) || []).sort((a, b) => (a.order || 0) - (b.order || 0));
          const matchesProj = !filter || proj.name.toLowerCase().includes(lower);
          const matchingPages = !filter ? pages : pages.filter(p => p.name.toLowerCase().includes(lower));

          if (matchesProj || matchingPages.length > 0) {
            const depth = getDepth(proj.id);
            if (matchesProj && !filter) {
              // Show project as an item (only when no filter, to avoid clutter)
              items.push({
                type: 'project',
                projectId: proj.id,
                pageId: null,
                label: proj.name,
                labelLower: proj.name.toLowerCase(),
                indent: depth
              });
            }
            for (const page of matchingPages) {
              items.push({
                type: 'page',
                projectId: proj.id,
                pageId: page.id,
                label: page.name || (t('untitled') || 'Untitled'),
                labelLower: (page.name || '').toLowerCase(),
                indent: depth + 1
              });
            }
          }
        } else {
          // Non-checklist project — show as a single item
          if (!filter || proj.name.toLowerCase().includes(lower)) {
            const depth = getDepth(proj.id);
            items.push({
              type: 'project',
              projectId: proj.id,
              pageId: null,
              label: proj.name,
              labelLower: proj.name.toLowerCase(),
              indent: depth
            });
          }
        }
      }

      // Render items
      for (const item of items) {
        const row = el('button', {
          type: 'button',
          class: 'btn',
          style: {
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            justifyContent: 'flex-start',
            padding: '10px 12px',
            marginBottom: '2px',
            borderRadius: '8px',
            textAlign: 'left',
            border: 'none',
            background: (item.projectId === initial.projectId && item.pageId === initial.pageId)
              ? 'var(--surface2)' : 'transparent'
          },
          onClick: () => {
            resolve({ projectId: item.projectId, pageId: item.pageId });
          }
        });

        // Icon based on type
        const icon = item.type === 'inbox' ? '📥 '
          : item.type === 'page' ? '📄 '
          : '📁 ';

        // Indentation spacer
        const indent = item.indent > 0 ? el('span', { style: { display:'inline-block', width: (item.indent * 20) + 'px' } }) : null;

        row.append(
          indent || '',
          el('span', {}, icon),
          el('span', { style: { marginLeft: '6px', fontSize: '0.9rem' } }, item.label)
        );

        listEl.appendChild(row);
      }

      if (items.length === 0) {
        listEl.appendChild(
          el('div', { class: 'small', style: { padding: '20px', textAlign: 'center', color: 'var(--muted)' } },
            t('noResults') || 'No matches found'
          )
        );
      }
    }

    searchInput.addEventListener('input', () => {
      currentFilter = searchInput.value;
      buildTree(currentFilter);
    });

    buildTree('');

    const content = el('div', { class: 'stack' }, searchInput, listEl);

    openModal(modalHost, {
      title: t('move') || 'Move',
      content,
      align: 'top',
      actions: [
        { label: t('cancel') || 'Cancel', class: 'btn btn--ghost', onClick: () => (resolve(undefined), true) }
      ]
    });

    // Focus search input
    setTimeout(() => searchInput.focus(), 100);
  });
}
