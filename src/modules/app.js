import { router } from './router.js';
import { db } from './data/db.js';
import { renderInbox } from './screens/inbox.js';
import { renderProjects, openCreateProject } from './screens/projects.js';
import { renderProjectDetail, openProjectAddMenu } from './screens/projectDetail.js';
import { renderArchive } from './screens/archive.js';
import { renderSettings } from './screens/settings.js';
import { renderHelp } from './screens/help.js';
import { openTodoEditor } from './ui/todoEditor.js';
import { openTodoInfo } from './ui/todoInfo.js';
import { el } from './ui/dom.js';
import { applyTheme, applyPalette } from './ui/theme.js';
import { autoArchiveCompleted, autoEmptyBin } from './logic/todoOps.js';
import { hapticLight } from './ui/haptic.js';
import { t } from './utils/i18n.js';
import { openModal } from './ui/modal.js';
import { openRecordingModal } from './ui/voiceMemo.js';
import { openBulkAddModal } from './ui/bulkAdd.js';
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
  const options = { month: 'short', day: 'numeric' };
  const dateStr = now.toLocaleDateString(undefined, options);
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
    db
  };

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

      // Deep-link to a specific task — redirect to the right project/inbox and open modal
      if (route.name === 'goto-task') {
        const targetTodo = await db.todos.get(route.params.taskId);
        if (targetTodo) {
          window.__pendingTaskId = targetTodo.id;
          location.hash = targetTodo.projectId ? `#project/${targetTodo.projectId}` : '#inbox';
        } else {
          location.hash = '#inbox';
        }
        return;
      }

      // Render screen
      if (route.name === 'inbox') {
        topbarTitle.textContent = t('inbox');
        appendDateToTopbar(topbarActions);
        topbarActions.append(
          el('button', { class: 'topbar__addBtn', type: 'button', 'aria-label': t('addTask'), onClick: () => { 
            hapticLight(); 
            openInboxAddMenu(ctx, modalHost);
          } }, '+')
        );
        await renderInbox(ctx);
      } else if (route.name === 'projects') {
        topbarTitle.textContent = t('projects');
        appendDateToTopbar(topbarActions);
        topbarActions.append(
          el('button', { class: 'topbar__addBtn', type: 'button', 'aria-label': t('newProject'), onClick: () => { hapticLight(); openCreateProject({ db, modalHost, onCreated: () => router.refresh() }); } }, '+')
        );
        await renderProjects(ctx);
      } else if (route.name === 'project') {
        const project = await db.projects.get(route.params.projectId);
        topbarTitle.textContent = project ? project.name : 'Project';
        if (project) {
          topbarActions.append(
            el('button', { 
                class: 'topbar__backBtn', 
                type: 'button', 
                'aria-label': 'Back', 
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
            topbarActions.append(
              el('button', { 
                  class: 'topbar__addBtn', 
                  type: 'button', 
                  'aria-label': 'Add item', 
                  onClick: () => { 
                      hapticLight(); 
                      openProjectAddMenu(ctx, project);
                  } 
              }, '+')
            );
          }
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
      } else if (route.name === 'help') {
        topbarTitle.textContent = t('help');
        topbarActions.append(
          el('button', { class: 'topbar__backBtn', type: 'button', 'aria-label': 'Back', onClick: () => { hapticLight(); location.hash = '#settings'; } }, '←')
        );
        await renderHelp(ctx);
      } else {
        location.hash = '#inbox';
      }

      // After render, move focus to main for accessibility.
      requestAnimationFrame(() => main.focus());

      // Open deep-linked task after render
      if (window.__pendingTaskId) {
        const pid = window.__pendingTaskId;
        window.__pendingTaskId = null;
        setTimeout(async () => {
          const t = await db.todos.get(pid);
          if (t) {
            openTodoInfo({
              todo: t,
              db,
              modalHost,
              onEdit: () => ctx.openTodoEditor({ mode: 'edit', todoId: t.id, projectId: t.projectId, db })
            });
          }
        }, 100);
      }
    }
  });

  // Overdue task notification on startup
  (async () => {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const active = await db.todos.listActive();
      const now = new Date();
      const overdue = active.filter(t => t.dueDate && !t.completed && new Date(t.dueDate) < now && new Date(t.dueDate) > new Date(now.getTime() - 86400000));
      if (overdue.length > 0) {
        const reg = await navigator.serviceWorker.ready;
        reg.showNotification('ThingsToDo', {
          body: `You have ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}.`,
          icon: './assets/icon-192.png',
          badge: './assets/icon-192.png',
          data: { url: '/#inbox' }
        });
      }
    } catch (e) { /* ignore */ }
  })();
}
// Inbox add menu (task or voice memo)
function openInboxAddMenu(ctx, modalHost) {
  let closeModal = null;

  const content = el('div', { class: 'stack' },
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
    }, '📋 ' + (t('addMultipleTasks') || 'Add Multiple Tasks')),
    el('button', {
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
    }, '🎤 ' + t('voiceMemo'))
  );

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