import { router } from './router.js';
import { db } from './data/db.js';
import { renderInbox } from './screens/inbox.js';
import { renderProjects, openCreateProject } from './screens/projects.js';
import { renderProjectDetail, openProjectAddMenu } from './screens/projectDetail.js';
import { renderArchive } from './screens/archive.js';
import { renderSettings } from './screens/settings.js';
import { renderHelp } from './screens/help.js';
import { openTodoEditor } from './ui/todoEditor.js';
import { el } from './ui/dom.js';
import { applyTheme, applyPalette } from './ui/theme.js';
import { autoArchiveCompleted, autoEmptyBin } from './logic/todoOps.js';
import { hapticLight } from './ui/haptic.js';
import { t } from './utils/i18n.js';
import { openModal } from './ui/modal.js';
import { openRecordingModal } from './ui/voiceMemo.js';
import { openBulkAddModal } from './ui/bulkAdd.js';
import { newTodo, Priority } from './data/models.js';

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

        // Show Group button if allowed in settings
        if (settings?.taskGrouping?.enabled === true) {
          topbarActions.append(
            el('button', { class: 'topbar__addBtn', type: 'button', style: { marginLeft: '8px' }, 'aria-label': 'Group', onClick: async () => {
              hapticLight();
              // Open grouping modal
              const groupingOptions = el('div', { class: 'stack' },
                el('button', { class: 'btn', style: { justifyContent: 'flex-start' }, onClick: async () => {
                  // Group All selected
                  const s = await db.settings.get();
                  const next = { ...s, taskGrouping: { ...(s.taskGrouping || {}), groupedLevels: [Priority.URGENT, Priority.P0, Priority.P1, Priority.P2, Priority.P3] } };
                  await db.settings.put(next);
                  renderInbox(ctx);
                  return true;
                } }, 'Group All'),
                el('button', { class: 'btn', style: { justifyContent: 'flex-start' }, onClick: async () => {
                  // Select which to group -> open picker
                  setTimeout(async () => {
                    // Build picker content
                    const levels = [Priority.URGENT, Priority.P0, Priority.P1, Priority.P2, Priority.P3];
                    const labels = {
                      [Priority.URGENT]: t('urgent') || 'Urgent!',
                      [Priority.P0]: t('highest') || 'Highest',
                      [Priority.P1]: t('high') || 'High',
                      [Priority.P2]: t('medium') || 'Medium',
                      [Priority.P3]: t('low') || 'Low'
                    };
                    const container = el('div', { class: 'stack' });
                    const checkMap = new Map();
                    for (const lv of levels) {
                      const cb = el('input', { type: 'checkbox' });
                      checkMap.set(lv, cb);
                      const color = (lv === Priority.URGENT) ? 'var(--pUrgent)' : (lv === Priority.P0 ? 'var(--p0)' : (lv === Priority.P1 ? 'var(--p1)' : (lv === Priority.P2 ? 'var(--p2)' : 'var(--p3)')));
                      const row = el('label', { class: 'row', style: { alignItems: 'center', gap: '8px' } },
                        cb,
                        el('span', { style: { width: '12px', height: '12px', borderRadius: '50%', background: color, display: 'inline-block' } }),
                        el('span', {}, labels[lv])
                      );
                      container.appendChild(row);
                    }

                    openModal(modalHost, {
                      title: 'Select priorities to group',
                      content: container,
                      actions: [
                        { label: t('cancel') || 'Cancel', class: 'btn btn--ghost', onClick: () => true },
                        { label: t('save') || 'Save', class: 'btn btn--primary', onClick: async () => {
                          const selected = [];
                          for (const [lv, cb] of checkMap.entries()) if (cb.checked) selected.push(lv);
                          const s = await db.settings.get();
                          const next = { ...s, taskGrouping: { ...(s.taskGrouping || {}), groupedLevels: selected } };
                          await db.settings.put(next);
                          await renderInbox(ctx);
                          return true;
                        } }
                      ]
                    });
                  }, 0);
                  return true;
                } }, 'Select which to group')
              );

              openModal(modalHost, {
                title: 'Group tasks',
                content: groupingOptions,
                actions: [ { label: t('cancel') || 'Cancel', class: 'btn btn--ghost', onClick: () => true } ]
              });
            } }, 'Group')
          );
        }
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
                onClick: () => { 
                    hapticLight(); 
                    if (project.parentId) {
                        location.hash = '#project/' + project.parentId;
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
    }
  });
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
