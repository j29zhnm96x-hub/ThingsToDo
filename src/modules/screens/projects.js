import { el, clear } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { confirm } from '../ui/confirm.js';
import { newProject } from '../data/models.js';

export async function renderProjects(ctx) {
  const { main, db, modalHost } = ctx;
  clear(main);

  const projects = await db.projects.list();

  const addBtn = el('button', { class: 'btn btn--primary', type: 'button', onClick: () => openCreateProject() }, 'Create Project');

  const list = el('div', { class: 'list' },
    projects.map((p) =>
      el('div', { class: 'card' },
        el('div', { class: 'row' },
          el('button', {
            type: 'button',
            class: 'btn btn--ghost',
            style: { textAlign: 'left', padding: '0', border: '0', background: 'transparent' },
            onClick: () => (location.hash = `#project/${p.id}`),
            'aria-label': `Open project ${p.name}`
          }, p.name),
          el('button', { type: 'button', class: 'iconBtn', 'aria-label': 'Project options', onClick: () => openProjectMenu(p) }, '⋯')
        )
      )
    )
  );

  main.append(el('div', { class: 'stack' }, addBtn, projects.length ? list : el('div', { class: 'card small' }, 'No projects yet. Create one to organize your todos.')));

  function openCreateProject() {
    const nameInput = el('input', { class: 'input', placeholder: 'Project name', 'aria-label': 'Project name' });
    const content = el('div', { class: 'stack' },
      el('label', { class: 'label' }, el('span', {}, 'Name'), nameInput)
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
            await db.projects.put(newProject({ name }));
            await renderProjects(ctx);
            return true;
          }
        }
      ]
    });

    requestAnimationFrame(() => nameInput.focus());
  }

  function openProjectMenu(project) {
    const renameBtn = el('button', { class: 'btn', type: 'button' }, 'Rename');
    const deleteBtn = el('button', { class: 'btn btn--danger', type: 'button' }, 'Delete');

    renameBtn.addEventListener('click', () => openRename(project));
    deleteBtn.addEventListener('click', () => openDelete(project));

    openModal(modalHost, {
      title: project.name,
      content: el('div', { class: 'stack' },
        el('div', { class: 'small' }, 'Project actions'),
        renameBtn,
        deleteBtn
      ),
      actions: [{ label: 'Close', class: 'btn btn--ghost', onClick: () => true }]
    });
  }

  function openRename(project) {
    const input = el('input', { class: 'input', value: project.name, 'aria-label': 'New project name' });
    openModal(modalHost, {
      title: 'Rename Project',
      content: el('div', { class: 'stack' }, el('label', { class: 'label' }, el('span', {}, 'Name'), input)),
      actions: [
        { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true },
        {
          label: 'Save',
          class: 'btn btn--primary',
          onClick: async () => {
            const name = input.value.trim();
            if (!name) return false;
            await db.projects.put({ ...project, name });
            await renderProjects(ctx);
            return true;
          }
        }
      ]
    });
    requestAnimationFrame(() => input.focus());
  }

  async function openDelete(project) {
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
