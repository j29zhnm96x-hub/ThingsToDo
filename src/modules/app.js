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
import { applyTheme } from './ui/theme.js';
import { autoArchiveCompleted, autoEmptyBin } from './logic/todoOps.js';
import { hapticLight } from './ui/haptic.js';
import { t } from './utils/i18n.js';
import { openModal } from './ui/modal.js';
import { openRecordingModal } from './ui/voiceMemo.js';

export function initApp(root) {
  const main = document.getElementById('main');
  const topbarTitle = document.getElementById('topbarTitle');
  const topbarActions = document.getElementById('topbarActions');
  const modalHost = document.getElementById('modalHost');
  const tabButtons = Array.from(document.querySelectorAll('.tabbar__tab'));

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

  router.init({
    async onRoute(route) {
      // Ensure DB is ready once at startup.
      await db.ready();

      document.body.classList.remove('focus-mode');

      // Auto-archive completed todos older than 24h (runs on each navigation, but fast)
      await autoArchiveCompleted(db);
      // Empty bin items older than 24h
      await autoEmptyBin(db);

      // Apply persisted theme (default: dark).
      const settings = await db.settings.get();
      applyTheme(settings.theme || 'dark');

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
        topbarActions.append(
          el('button', { class: 'topbar__addBtn', type: 'button', 'aria-label': t('addTask'), onClick: () => { 
            hapticLight(); 
            openInboxAddMenu(ctx, modalHost);
          } }, '+')
        );
        await renderInbox(ctx);
      } else if (route.name === 'projects') {
        topbarTitle.textContent = t('projects');
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
        await renderArchive(ctx);
      } else if (route.name === 'settings') {
        topbarTitle.textContent = t('settings');
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
  openModal(modalHost, {
    title: t('addToInbox') || 'Add to Inbox',
    align: 'bottom',
    content: el('div', { class: 'stack' }, 
      el('button', { 
        class: 'btn btn--primary',
        style: { justifyContent: 'flex-start', padding: '16px' }, 
        onClick: () => {
          ctx.openTodoEditor({ mode: 'create', projectId: null });
          return true;
        }
      }, '📄 ' + t('newTask')),
      el('button', { 
        class: 'btn', 
        style: { justifyContent: 'flex-start', padding: '16px' }, 
        onClick: () => {
          openRecordingModal({
            modalHost,
            db,
            projectId: null,
            onSaved: () => router.refresh()
          });
          return true;
        }
      }, '🎤 ' + t('voiceMemo'))
    ),
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true }
    ]
  });
}