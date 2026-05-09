import { el, clear, emptyState } from '../ui/dom.js';
import { searchAll, debounce } from '../search.js';
import { t } from '../utils/i18n.js';
import { hapticLight } from '../ui/haptic.js';
import { openPlaybackModal } from '../ui/voiceMemo.js';

export async function renderSearch(ctx) {
  const { main, db, modalHost } = ctx;
  clear(main);

  const input = el('input', {
    type: 'search',
    class: 'search-input',
    placeholder: t('searchPlaceholder'),
    'aria-label': t('search'),
    autofocus: 'true',
    autocomplete: 'off',
    enterkeyhint: 'search'
  });

  const resultsEl = el('div', { class: 'search-results' });

  const noResults = emptyState(t('searchEmpty'), t('searchEmptyHint'));
  noResults.style.display = 'none';

  const doSearch = debounce(async (raw) => {
    const query = raw.trim();
    if (!query) {
      resultsEl.innerHTML = '';
      noResults.style.display = 'none';
      return;
    }
    const results = await searchAll(db, query);
    renderResults(resultsEl, noResults, results, ctx, query);
  }, 300);

  input.addEventListener('input', () => doSearch(input.value));

  main.append(input, resultsEl, noResults);

  // Focus input after render
  requestAnimationFrame(() => input.focus());
}

function renderResults(container, noResults, results, ctx, query) {
  container.innerHTML = '';
  let any = false;

  // Section builder
  const section = (label, count, icon) => {
    any = true;
    const header = el('div', { class: 'search-section' }, `${icon} ${label} (${count})`);
    const list = el('div', { class: 'search-section-list' });
    container.append(header, list);
    return list;
  };

  // Todos
  if (results.todos.length) {
    const list = section(t('tasks'), results.todos.length, '📄');
    for (const todo of results.todos) {
      const projectLabel = todo._projectName ? ` ${t('in')} ${todo._projectName}` : '';
      list.append(makeTodoResult(todo, projectLabel, ctx));
    }
  }

  // Projects
  if (results.projects.length) {
    const list = section(t('projects'), results.projects.length, '📁');
    for (const p of results.projects) {
      list.append(makeProjectResult(p, ctx));
    }
  }

  // Voice memos
  if (results.voiceMemos.length) {
    const list = section(t('voiceMemos'), results.voiceMemos.length, '🎤');
    for (const m of results.voiceMemos) {
      list.append(makeMemoResult(m, ctx));
    }
  }

  noResults.style.display = any ? 'none' : '';
}

function makeTodoResult(todo, projectLabel, ctx) {
  const { db, modalHost } = ctx;
  return el('div', {
    class: 'search-result',
    dataset: { todoId: todo.id },
    onClick: () => {
      hapticLight();
      // Store highlight id before navigating
      sessionStorage.setItem('searchHighlight', todo.id);
      // If it's a checklist item, pre-set the page
      if (todo.pageId && todo.projectId) {
        try { localStorage.setItem(`checklist-page-${todo.projectId}`, todo.pageId); } catch { /* noop */ }
      }
      location.hash = todo.projectId ? `#project/${todo.projectId}` : '#inbox';
    }
  },
    el('div', { class: 'search-result__title' }, todo.title || ''),
    el('div', { class: 'search-result__sub' },
      '📝 ' + (t('searchInProject') || 'In'),
      projectLabel
    )
  );
}

function makeProjectResult(project, ctx) {
  return el('div', {
    class: 'search-result',
    dataset: { projectId: project.id },
    onClick: () => {
      hapticLight();
      location.hash = `#project/${project.id}`;
    }
  },
    el('div', { class: 'search-result__title' }, project.name || ''),
    el('div', { class: 'search-result__sub' },
      project.type === 'checklist' ? '✅ ' + t('checklist') : '📋 ' + t('project')
    )
  );
}

function makeMemoResult(memo, ctx) {
  const { db, modalHost } = ctx;
  return el('div', {
    class: 'search-result',
    dataset: { memoId: memo.id },
    onClick: () => {
      hapticLight();
      openPlaybackModal({ modalHost, db, memo, onChange: () => {} });
    }
  },
    el('div', { class: 'search-result__title' }, memo.title || ''),
    el('div', { class: 'search-result__sub' },
      '🎤 ' + (memo.duration ? formatDuration(memo.duration) : '')
    )
  );
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
