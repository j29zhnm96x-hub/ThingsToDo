import { el, clear, emptyState } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { confirm } from '../ui/confirm.js';
import { newProject } from '../data/models.js';
import { hapticLight } from '../ui/haptic.js';
import { scheduleChecklistReminder } from '../notifications.js';

export async function renderProjects(ctx) {
  const { main, db, modalHost } = ctx;
  clear(main);

  const projects = await db.projects.list();

  // Get active todo counts for each project
  const projectCounts = new Map();
  for (const p of projects) {
    const todos = await db.todos.listByProject(p.id);
    const activeCount = todos.filter((t) => !t.archived && !t.completed).length;
    projectCounts.set(p.id, activeCount);
  }

  const list = el('div', { class: 'list' },
    projects.map((p) => {
      const activeCount = projectCounts.get(p.id) || 0;
      const projectType = p.type || 'default';
      return el('div', {
        class: 'projectCard',
        dataset: { type: projectType },
        onClick: (e) => {
          if (e.target.closest('.projectCard__menuBtn')) return;
          hapticLight();
          location.hash = `#project/${p.id}`;
        },
        'aria-label': `Open project ${p.name}`
      },
        el('div', { class: 'projectCard__row' },
          el('div', { class: 'projectCard__info' },
            el('span', { class: 'projectCard__name' }, 
              p.name,
              p.protected ? el('img', { src: 'assets/shield.PNG', class: 'icon-protected', alt: 'Protected' }) : null
            ),
            activeCount > 0 ? el('span', { class: 'projectCard__count' }, `${activeCount} active`) : null
          ),
          el('button', {
            type: 'button',
            class: 'projectCard__menuBtn iconBtn',
            'aria-label': 'Project options',
            onClick: (e) => { e.stopPropagation(); hapticLight(); openProjectMenu(p); }
          }, '⋯')
        )
      );
    })
  );

  main.append(el('div', { class: 'stack' }, projects.length ? list : emptyState('No projects yet', 'Tap the + button above to create your first project')));

  function openProjectMenu(project) {
    const editBtn = el('button', { class: 'btn', type: 'button' }, 'Edit');
    const deleteBtn = el('button', { class: 'btn btn--danger', type: 'button' }, 'Delete');

    editBtn.addEventListener('click', () => openEdit(project));
    deleteBtn.addEventListener('click', () => openDelete(project));

    openModal(modalHost, {
      title: project.name,
      content: el('div', { class: 'stack' },
        el('div', { class: 'small' }, 'Project actions'),
        editBtn,
        deleteBtn
      ),
      actions: [{ label: 'Close', class: 'btn btn--ghost', onClick: () => true }]
    });
  }

  function openEdit(project) {
    const input = el('input', { class: 'input', value: project.name, 'aria-label': 'Project name' });
    const protectedInput = el('input', { type: 'checkbox', checked: project.protected ? 'checked' : null, 'aria-label': 'Protect project' });

    openModal(modalHost, {
      title: 'Edit Project',
      content: el('div', { class: 'stack' }, 
        el('label', { class: 'label' }, el('span', {}, 'Name'), input),
        el('label', { class: 'label' }, el('span', {}, 'Protect project'), protectedInput),
        el('div', { class: 'small', style: { marginTop: '-0.5rem', color: 'var(--text-muted)' } }, 'Protected projects cannot be deleted easily.')
      ),
      actions: [
        { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true },
        {
          label: 'Save',
          class: 'btn btn--primary',
          onClick: async () => {
            const name = input.value.trim();
            if (!name) return false;
            await db.projects.put({ ...project, name, protected: protectedInput.checked });
            await renderProjects(ctx);
            return true;
          }
        }
      ]
    });
    requestAnimationFrame(() => input.focus());
  }

  async function openDelete(project) {
    if (project.protected) {
      openModal(modalHost, {
        title: 'Project Protected',
        content: el('div', {}, 'This project is protected. Please uncheck "Protect project" in the edit menu to delete it.'),
        actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }]
      });
      return;
    }

    // Confirmation prompt offering:
    // - Move its todos to Inbox
    // - OR archive its todos

    const content = el('div', { class: 'stack' },
      el('div', { class: 'small' }, 'Deleting a project is destructive. Choose what to do with its todos.'),
      el('div', { class: 'small' }, 'Option 1: Move todos to Inbox'),
      el('div', { class: 'small' }, 'Option 2: Archive todos')
    );

    openModal(modalHost, {
      title: `Delete “${project.name}”?`,
      content,
      actions: [
        { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true },
        {
          label: 'Move todos to Inbox + Delete',
          class: 'btn',
          onClick: async () => {
            const ok = await confirm(modalHost, {
              title: 'Confirm delete',
              message: 'Move all project todos to Inbox and delete the project?',
              confirmLabel: 'Delete',
              danger: true
            });
            if (!ok) return false;
            const todos = (await db.todos.listByProject(project.id)).filter((t) => !t.archived);
            for (const t of todos) await db.todos.put({ ...t, projectId: null });
            await db.projects.delete(project.id);
            await renderProjects(ctx);
            return true;
          }
        },
        {
          label: 'Archive todos + Delete',
          class: 'btn btn--danger',
          onClick: async () => {
            const ok = await confirm(modalHost, {
              title: 'Confirm delete',
              message: 'Archive all project todos and delete the project?',
              confirmLabel: 'Archive + Delete',
              danger: true
            });
            if (!ok) return false;
            const todos = (await db.todos.listByProject(project.id)).filter((t) => !t.archived);
            for (const t of todos) {
              await db.todos.put({
                ...t,
                archived: true,
                archivedAt: new Date().toISOString(),
                archivedFromProjectId: project.id
              });
            }
            await db.projects.delete(project.id);
            await renderProjects(ctx);
            return true;
          }
        }
      ]
    });
  }
}

export function openCreateProject({ db, modalHost, onCreated }) {
  const nameInput = el('input', { class: 'input', placeholder: 'Project name', 'aria-label': 'Project name' });
  const typeSelect = el('select', { class: 'select', 'aria-label': 'Project type' },
    el('option', { value: 'default', selected: 'selected' }, 'Default'),
    el('option', { value: 'checklist' }, 'Check List')
  );

  const content = el('div', { class: 'stack' },
    el('label', { class: 'label' }, el('span', {}, 'Name'), nameInput),
    el('label', { class: 'label' }, el('span', {}, 'Project Type'), typeSelect)
  );

  openModal(modalHost, {
    title: 'Create Project',
    content,
    actions: [
      { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true },
      {
        label: 'Create',
        class: 'btn btn--primary',
        onClick: async () => {
          const name = nameInput.value.trim();
          if (!name) {
            nameInput.focus();
            return false;
          }
          const type = typeSelect.value === 'checklist' ? 'checklist' : 'default';
          const project = newProject({ name, type });
          await db.projects.put(project);
          
          if (type === 'checklist') {
            scheduleChecklistReminder(project.id);
          }

          onCreated?.();
          return true;
        }
      }
    ]
  });

  requestAnimationFrame(() => nameInput.focus());
}
