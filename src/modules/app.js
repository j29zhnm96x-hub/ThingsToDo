import { router } from './router.js';
import { db } from './data/db.js';
import { renderInbox } from './screens/inbox.js';
import { renderProjects } from './screens/projects.js';
import { renderProjectDetail } from './screens/projectDetail.js';
import { renderArchive } from './screens/archive.js';
import { renderSettings } from './screens/settings.js';
import { openTodoEditor } from './ui/todoEditor.js';
import { el } from './ui/dom.js';
import { applyTheme } from './ui/theme.js';

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
    openTodoEditor: (opts) => openTodoEditor({ ...opts, modalHost, onChange: () => router.refresh() }),
    db
  };

  // SPA nav: bottom tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = btn.getAttribute('data-route');
      if (route) location.hash = route;
    });
  });

  router.init({
    async onRoute(route) {
      // Ensure DB is ready once at startup.
      await db.ready();

      // Apply persisted theme (default: dark).
      const settings = await db.settings.get();
      applyTheme(settings.theme || 'dark');

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
        topbarTitle.textContent = 'Inbox';
        topbarActions.append(
          el('button', { class: 'btn btn--primary', type: 'button', onClick: () => ctx.openTodoEditor({ mode: 'create', projectId: null }) }, 'Add')
        );
        await renderInbox(ctx);
      } else if (route.name === 'projects') {
        topbarTitle.textContent = 'Projects';
        await renderProjects(ctx);
      } else if (route.name === 'project') {
        const project = await db.projects.get(route.params.projectId);
        topbarTitle.textContent = project ? project.name : 'Project';
        if (project) {
          topbarActions.append(
            el('button', { class: 'btn btn--primary', type: 'button', onClick: () => ctx.openTodoEditor({ mode: 'create', projectId: project.id }) }, 'Add')
          );
        }
        await renderProjectDetail(ctx, route.params.projectId);
      } else if (route.name === 'archive') {
        topbarTitle.textContent = 'Archive';
        await renderArchive(ctx);
      } else if (route.name === 'settings') {
        topbarTitle.textContent = 'Settings';
        await renderSettings(ctx);
      } else {
        location.hash = '#inbox';
      }

      // After render, move focus to main for accessibility.
      requestAnimationFrame(() => main.focus());
    }
  });

  // Default route
  if (!location.hash) location.hash = '#inbox';
}
