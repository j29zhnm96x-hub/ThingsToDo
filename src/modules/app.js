import { router } from './router.js';
import { db } from './data/db.js';
import { renderInbox } from './screens/inbox.js';
import { renderProjects, openCreateProject } from './screens/projects.js';
import { renderProjectDetail, openProjectAddMenu } from './screens/projectDetail.js';
import { renderArchive } from './screens/archive.js';
import { renderSettings } from './screens/settings.js';
import { renderHelp } from './screens/help.js';
import { renderSearch } from './screens/search.js';
import { renderStats } from './screens/stats.js';
import { renderDebug } from './screens/debug.js';
import { openTodoEditor } from './ui/todoEditor.js';
import { createQuickAddButton, updateQuickAddButton } from './ui/quickAdd.js';
import { el } from './ui/dom.js';
import { applyTheme, applyPalette } from './ui/theme.js';
import { autoArchiveCompleted, autoEmptyBin } from './logic/todoOps.js';
import { hapticLight } from './ui/haptic.js';
import { t, getLang } from './utils/i18n.js';
import { openModal } from './ui/modal.js';
import { openRecordingModal } from './ui/voiceMemo.js';
import { openBulkAddModal } from './ui/bulkAdd.js';
import { openSmartAdd } from './ui/smartAdd.js';
import { newTodo } from './data/models.js';

let topbarDateIntervalId = null;

function getCurrentDayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clearTopbarDateInterval() {
  if (topbarDateIntervalId !== null) {
    clearInterval(topbarDateIntervalId);
    topbarDateIntervalId = null;
  }
}

function getCurrentDateString() {
  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = t(days[now.getDay()]);
  const lang = getLang() || 'en';
  const localeMap = { en: 'en-US', hr: 'hr-HR', it: 'it-IT', de: 'de-DE', es: 'es-ES' };
  const locale = localeMap[lang] || 'en-US';
  const options = { month: 'short', day: 'numeric' };
  const dateStr = now.toLocaleDateString(locale, options);
  return `${dayName}, ${dateStr}`;
}

function appendDateToTopbar(topbarActions) {
  clearTopbarDateInterval();
  const dateEl = el('div', { class: 'topbar__date', 'aria-label': 'Current date' }, getCurrentDateString());
  topbarActions.append(dateEl);
  // Update every minute
  topbarDateIntervalId = setInterval(() => {
    dateEl.textContent = getCurrentDateString();
  }, 60000);
}

export function initApp(root) {
  const main = document.getElementById('main');
  const topbarTitle = document.getElementById('topbarTitle');
  const topbarActions = document.getElementById('topbarActions');
  const modalHost = document.getElementById('modalHost');
  const tabButtons = Array.from(document.querySelectorAll('.tabbar__tab'));
  let lastDayKey = getCurrentDayKey();
  let dayRefreshTimeoutId = null;

  function clearDayRefreshTimeout() {
    if (dayRefreshTimeoutId !== null) {
      clearTimeout(dayRefreshTimeoutId);
      dayRefreshTimeoutId = null;
    }
  }

  function scheduleDayRefreshCheck() {
    clearDayRefreshTimeout();
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 1, 0);
    const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());
    dayRefreshTimeoutId = setTimeout(() => {
      void refreshIfDayChanged();
    }, delay);
  }

  async function refreshIfDayChanged() {
    const nextDayKey = getCurrentDayKey();
    if (nextDayKey === lastDayKey) {
      scheduleDayRefreshCheck();
      return;
    }
    lastDayKey = nextDayKey;
    await router.refresh();
    scheduleDayRefreshCheck();
  }

  function handleAppVisible() {
    if (document.visibilityState === 'hidden') return;
    void refreshIfDayChanged();
  }

  const ctx = {
    root,
    main,
    topbarTitle,
    topbarActions,
    modalHost,
    // Always pass `db` so create/edit both work.
    openTodoEditor: (opts) => openTodoEditor({ ...opts, db, modalHost, onChange: () => router.refresh() }),
    openInboxAddMenu: (mh) => openInboxAddMenu(ctx, mh),
    openSmartAdd: (context) => openSmartAdd(ctx, context),
    db
  };

  // Floating Quick Add button
  const quickAddBtn = createQuickAddButton(ctx);
  root?.appendChild(quickAddBtn);

  // Re-measure scrolling text on resize/orientation change
  let resizeTimer;
  let wasPortrait = window.innerHeight > window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    const isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait !== wasPortrait) {
      wasPortrait = isPortrait;
      // Refresh page so all scrolls are freshly evaluated
      setTimeout(() => router.refresh(), 350);
      return;
    }
    // Same orientation, just a slight size change — handle with pausing
    resizeTimer = setTimeout(() => {
      document.querySelectorAll('.todo__title, .checklist__text, .projectCard__compactName').forEach(el => {
        if (el.scrollWidth <= el.clientWidth) {
          el.dataset.scrollStop = 'true';
          el.dataset.scrollPause = String(performance.now());
          el.style.textIndent = '0';
        } else if (el.dataset.scrollStop === 'true') {
          delete el.dataset.scrollStop;
          const pausedAt = parseFloat(el.dataset.scrollPause) || 0;
          if (pausedAt && el._scrollStart) {
            el._scrollStart += performance.now() - pausedAt;
          }
          delete el.dataset.scrollPause;
        }
      });
    }, 300);
  });

  // SPA nav: bottom tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      hapticLight();
      const route = btn.getAttribute('data-route');
      if (route) location.hash = route;
    });
  });

  // Default route: avoid assigning location.hash here (can fire a hashchange event
  // that races with the initial router refresh on some platforms).
  if (!location.hash) {
    history.replaceState(null, '', `${location.pathname}${location.search}#inbox`);
  }

  document.addEventListener('visibilitychange', handleAppVisible);
  window.addEventListener('focus', handleAppVisible);
  window.addEventListener('pageshow', handleAppVisible);
  scheduleDayRefreshCheck();

  router.init({
    async onRoute(route) {
      // Ensure DB is ready once at startup.
      await db.ready();
      lastDayKey = getCurrentDayKey();
      scheduleDayRefreshCheck();

      document.body.classList.remove('focus-mode');
      clearTopbarDateInterval();

      // Auto-archive completed todos older than 24h (runs on each navigation, but fast)
      await autoArchiveCompleted(db);
      // Empty bin items older than 24h
      await autoEmptyBin(db);

      // Apply persisted theme and palette (default: dark + default palette).
      const settings = await db.settings.get();
      applyTheme(settings.theme || 'dark');
      applyPalette(settings.themePalette || 'default');

      // Update tab labels with translations
      tabButtons.forEach((btn) => {
        const route = btn.getAttribute('data-route') || '';
        const key = route.replace('#', '');
        const label = btn.querySelector('.tabbar__label');
        if (label && t(key) !== key) {
          label.textContent = t(key);
          btn.setAttribute('aria-label', t(key));
        }
      });

      // Update active tab
      const current = route.group;
      tabButtons.forEach((btn) => {
        const r = btn.getAttribute('data-route') || '';
        const group = r.replace('#', '').split('/')[0];
        if (group === current) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
      });

      topbarActions.innerHTML = '';

      // Render screen
      if (route.name === 'inbox') {
        topbarTitle.textContent = t('inbox');
        appendDateToTopbar(topbarActions);
        topbarActions.append(
          el('button', { class: 'topbar__addBtn', type: 'button', 'aria-label': t('search'), onClick: () => { hapticLight(); location.hash = '#search'; } }, '🔍')
        );
        await renderInbox(ctx);
      } else if (route.name === 'projects') {
        topbarTitle.textContent = t('projects');
        appendDateToTopbar(topbarActions);
        topbarActions.append(
          el('button', { class: 'topbar__addBtn', type: 'button', 'aria-label': t('newProject'), onClick: () => { hapticLight(); openCreateProject({ db, modalHost, onCreated: () => router.refresh() }); } }, '+'),
          el('button', { class: 'topbar__addBtn', type: 'button', 'aria-label': t('search'), onClick: () => { hapticLight(); location.hash = '#search'; } }, '🔍')
        );
        await renderProjects(ctx);
      } else if (route.name === 'project') {
        const project = await db.projects.get(route.params.projectId);
        topbarTitle.textContent = project ? project.name : t('project');
        if (project) {
          topbarActions.append(
            el('button', { 
                class: 'topbar__backBtn', 
                type: 'button', 
                'aria-label': t('back'), 
                onClick: async () => { 
                    hapticLight(); 
                    if (project.parentId) {
                        const parent = await db.projects.get(project.parentId);
                        if (parent) {
                            location.hash = '#project/' + project.parentId;
                        } else {
                            location.hash = '#projects';
                        }
                    } else {
                        location.hash = '#projects'; 
                    }
                } 
            }, '←')
          );
          if ((project.type ?? 'default') !== 'checklist') {
            const projAddBtn = el('button', { 
                class: 'topbar__addBtn', 
                type: 'button', 
                'aria-label': t('addItem')
            }, '+');
            let projLongPressTimer = null;
            let projIsLongPress = false;
            projAddBtn.addEventListener('click', () => {
              if (projIsLongPress) { projIsLongPress = false; return; }
              hapticLight();
              openProjectAddMenu(ctx, project);
            });
            projAddBtn.addEventListener('mousedown', () => {
              projIsLongPress = false;
              clearTimeout(projLongPressTimer);
              projLongPressTimer = setTimeout(() => {
                projIsLongPress = true;
                hapticLight?.();
                openSmartAdd(ctx, { mode: 'project', project, startMic: true });
              }, 500);
            });
            projAddBtn.addEventListener('mouseup', () => clearTimeout(projLongPressTimer));
            projAddBtn.addEventListener('mouseleave', () => clearTimeout(projLongPressTimer));
            projAddBtn.addEventListener('touchstart', () => {
              projIsLongPress = false;
              clearTimeout(projLongPressTimer);
              projLongPressTimer = setTimeout(() => {
                projIsLongPress = true;
                hapticLight?.();
                openSmartAdd(ctx, { mode: 'project', project, startMic: true });
              }, 500);
            }, { passive: true });
            projAddBtn.addEventListener('touchend', () => clearTimeout(projLongPressTimer));
            projAddBtn.addEventListener('touchcancel', () => clearTimeout(projLongPressTimer));
            topbarActions.append(projAddBtn);
          }
          topbarActions.append(
            el('button', { class: 'topbar__addBtn', type: 'button', 'aria-label': t('search'), onClick: () => { hapticLight(); location.hash = '#search'; } }, '🔍')
          );
        }
        await renderProjectDetail(ctx, route.params.projectId);
      } else if (route.name === 'archive') {
        topbarTitle.textContent = t('archive');
        appendDateToTopbar(topbarActions);
        await renderArchive(ctx);
      } else if (route.name === 'settings') {
        topbarTitle.textContent = t('settings');
        appendDateToTopbar(topbarActions);
        await renderSettings(ctx);
      } else if (route.name === 'stats') {
        topbarTitle.textContent = t('stats');
        appendDateToTopbar(topbarActions);
        await renderStats(ctx);
      } else if (route.name === 'search') {
        const scope = route.params.scope || 'all';
        if (scope === 'archive') {
          topbarTitle.textContent = t('searchArchive');
        } else {
          topbarTitle.textContent = t('search');
        }
        topbarActions.append(
          el('button', { class: 'topbar__backBtn', type: 'button', 'aria-label': t('back'), onClick: () => { hapticLight(); history.back(); } }, '←')
        );
        await renderSearch(ctx);
      } else if (route.name === 'help') {
        topbarTitle.textContent = t('help');
        topbarActions.append(
          el('button', { class: 'topbar__backBtn', type: 'button', 'aria-label': t('back'), onClick: () => { hapticLight(); location.hash = '#settings'; } }, '←')
        );
        await renderHelp(ctx);
      } else if (route.name === 'debug') {
        topbarTitle.textContent = 'Debug';
        topbarActions.append(
          el('button', { class: 'topbar__backBtn', type: 'button', 'aria-label': t('back'), onClick: () => { hapticLight(); location.hash = '#settings'; } }, '←')
        );
        await renderDebug(ctx);
      } else {
        location.hash = '#inbox';
      }

      // After render, check for search highlight
      setTimeout(() => {
        main.focus();
        const highlightId = sessionStorage.getItem('searchHighlight');
        if (highlightId) {
          sessionStorage.removeItem('searchHighlight');
          const card = document.querySelector(`[data-todo-id="${highlightId}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.transition = 'background 300ms ease';
            card.style.background = 'rgba(250, 204, 21, 0.35)';
            setTimeout(() => {
              card.style.background = '';
              card.style.transition = '';
            }, 1800);
          }
        }
        // Update quick add button visibility — inbox and project pages
        updateQuickAddButton(quickAddBtn, route.group, route.name);
      }, 100);
    }
  });
}
// Inbox add menu (task or voice memo)
async function openInboxAddMenu(ctx, modalHost) {
  let closeModal = null;

  const settings = await ctx.db.settings.get();
  const aiEnabled = settings.aiEnabled === true;

  const buttons = [
    el('button', {
      class: 'btn btn--primary',
      style: { justifyContent: 'flex-start', padding: '16px' },
      onClick: () => {
        closeModal?.();
        ctx.openTodoEditor({ mode: 'create', projectId: null });
      }
    }, '📄 ' + t('newTask')),
    el('button', {
      class: 'btn',
      style: { justifyContent: 'flex-start', padding: '16px' },
      onClick: () => {
        closeModal?.();
        openBulkAddModal(modalHost, {
          title: t('addMultipleTasks') || 'Add Multiple Tasks',
          label: t('tasks') || 'Tasks',
          placeholder: t('bulkAddExampleTasks') || 'Call plumber\nPlan trip\nPay rent',
          submitLabel: t('addTasks') || 'Add Tasks',
          onSubmit: async (items) => {
            await Promise.all(items.map((title) => db.todos.put(newTodo({ title, projectId: null }))));
            await router.refresh();
          }
        });
      }
    }, '📋 ' + (t('addMultipleTasks') || 'Add Multiple Tasks'))
  ];

  // Conditionally add Smart Add if AI is enabled
  if (aiEnabled) {
    buttons.push(el('button', {
      class: 'btn',
      style: { justifyContent: 'flex-start', padding: '16px' },
      onClick: () => {
        closeModal?.();
        ctx.openSmartAdd({ mode: 'inbox' });
      }
    }, '🤖 ' + t('aiSmartAdd')));
  }

  buttons.push(el('button', {
    class: 'btn',
    style: { justifyContent: 'flex-start', padding: '16px' },
    onClick: () => {
      closeModal?.();
      openRecordingModal({
        modalHost,
        db,
        projectId: null,
        onSaved: () => router.refresh()
      });
    }
  }, '🎤 ' + t('voiceMemo')));

  const content = el('div', { class: 'stack' }, ...buttons);

  const modalRef = openModal(modalHost, {
    title: t('addToInbox') || 'Add to Inbox',
    align: 'bottom',
    content,
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true }
    ]
  });

  closeModal = modalRef.close;
}