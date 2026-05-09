import { el, clear, emptyState } from '../ui/dom.js';
import { searchAll, debounce } from '../search.js';
import { t } from '../utils/i18n.js';
import { hapticLight } from '../ui/haptic.js';
import { openPlaybackModal } from '../ui/voiceMemo.js';

export async function renderSearch(ctx, scope = 'all') {
  const { main, db, modalHost } = ctx;
  clear(main);

  const input = el('input', {
    type: 'text',
    class: 'search-input',
    placeholder: scope === 'archive' ? t('searchArchivePlaceholder') : t('searchPlaceholder'),
    'aria-label': t('search'),
    autofocus: 'true',
    autocomplete: 'off',
    enterkeyhint: 'search',
    inputmode: 'search'
  });

  const resultsEl = el('div', { class: 'search-results' });

  const doSearch = debounce(async (raw) => {
    const query = raw.trim();
    if (!query) {
      resultsEl.innerHTML = '';
      return;
    }
    const results = await searchAll(db, query, scope);
    renderResults(resultsEl, results, ctx, scope);
  }, 300);

  input.addEventListener('input', () => doSearch(input.value));

  main.append(input, resultsEl);

  requestAnimationFrame(() => input.focus());
}

function renderResults(container, results, ctx, scope) {
  container.innerHTML = '';
  let any = false;

  const section = (label, count, icon) => {
    any = true;
    const header = el('div', { class: 'search-section' }, `${icon} ${label} (${count})`);
    const list = el('div', { class: 'search-section-list' });
    container.append(header, list);
    return list;
  };

  if (results.todos.length) {
    const label = scope === 'archive' ? t('archivedTasks') : t('tasks');
    const list = section(label, results.todos.length, '📄');
    for (const todo of results.todos) {
      list.append(makeTodoResult(todo, scope, ctx));
    }
  }

  if (results.projects.length) {
    const list = section(t('projects'), results.projects.length, '📁');
    for (const p of results.projects) {
      list.append(makeProjectResult(p, ctx));
    }
  }

  if (results.voiceMemos.length) {
    const list = section(t('voiceMemos'), results.voiceMemos.length, '🎤');
    for (const m of results.voiceMemos) {
      list.append(makeMemoResult(m, ctx));
    }
  }

  if (!any) {
    container.append(
      el('div', { class: 'search-empty' },
        el('div', { class: 'search-empty__icon' }, scope === 'archive' ? '📦' : '🔍'),
        el('div', { class: 'search-empty__text' }, scope === 'archive' ? t('searchNoArchived') : t('searchEmpty'))
      )
    );
  }
}

function makeTodoResult(todo, scope, ctx) {
  const subtitle = todo._projectName
    ? `${t('in')} ${todo._projectName}`
    : t('inbox');
  return el('div', {
    class: 'search-result',
    dataset: { todoId: todo.id },
    onClick: () => {
      hapticLight();
      if (scope !== 'archive') {
        // Navigate to the task's project for active tasks
        sessionStorage.setItem('searchHighlight', todo.id);
        if (todo.pageId && todo.projectId) {
          try { localStorage.setItem(`checklist-page-${todo.projectId}`, todo.pageId); } catch { /* noop */ }
        }
        location.hash = todo.projectId ? `#project/${todo.projectId}` : '#inbox';
      }
    }
  },
    el('div', { class: 'search-result__title' }, todo.title || ''),
    el('div', { class: 'search-result__sub' }, scope === 'archive'
      ? (todo.completedAt ? new Date(todo.completedAt).toLocaleDateString() : '')
      : subtitle
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
