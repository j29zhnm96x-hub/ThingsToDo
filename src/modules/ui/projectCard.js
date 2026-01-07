import { el } from './dom.js';

export function renderProjectCard({
  project,
  stats = { total: 0, completed: 0, active: 0 },
  onOpen,
  onMenu
}) {
  const projectType = project.type || 'default';
  const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

  return el('div', {
    class: 'projectCard',
    style: { position: 'relative' },
    dataset: { type: projectType, projectId: project.id },
    onClick: (e) => {
      if (e.target.closest('.projectCard__menuBtn')) return;
      onOpen?.(project, e);
    },
    'aria-label': `Open project ${project.name}`
  },
    el('div', { class: 'projectCard__row' },
      el('div', { class: 'projectCard__info' },
        el('span', { class: 'projectCard__name' }, project.name),
        stats.active > 0
          ? el('span', { class: 'projectCard__count' }, `${stats.active} active`)
          : (stats.total > 0 ? el('span', { class: 'projectCard__count' }, 'Done') : null)
      ),
      project.protected ? el('span', { class: 'icon-protected', 'aria-label': 'Protected' }, '🔒') : null,
      project.showInInbox ? el('span', { class: 'icon-protected', style: { opacity: 0.6 }, 'aria-label': 'Linked to Inbox' }, '🔗') : null,
      el('button', {
        type: 'button',
        class: 'projectCard__menuBtn iconBtn',
        'aria-label': 'Project options',
        onClick: (e) => {
          e.stopPropagation();
          onMenu?.(project, e);
        }
      }, '⋯')
    ),
    stats.total > 0
      ? el('div', { class: 'projectCard__progress', style: { width: `${progress}%` } })
      : null
  );
}
