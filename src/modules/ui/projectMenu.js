import { el } from './dom.js';
import { openModal } from './modal.js';
import { confirm } from './confirm.js';

async function deleteProjectRecursive(db, projectId) {
  const allProjects = await db.projects.list();
  const children = allProjects.filter((p) => p.parentId === projectId);
  for (const child of children) {
    await deleteProjectRecursive(db, child.id);
  }

  const todos = await db.todos.listByProject(projectId);
  for (const t of todos) {
    await db.todos.delete(t.id);
  }

  await db.projects.delete(projectId);
}

function openEditProject(modalHost, { db, project, onChange }) {
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
          onChange?.();
          return true;
        }
      }
    ]
  });

  requestAnimationFrame(() => input.focus());
}

async function openDeleteProject(modalHost, { db, project, onChange }) {
  if (project.protected) {
    openModal(modalHost, {
      title: 'Project Protected',
      content: el('div', {}, 'This project is protected. Please uncheck "Protect project" in the edit menu to delete it.'),
      actions: [{ label: 'OK', class: 'btn btn--primary', onClick: () => true }]
    });
    return;
  }

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

          // Move direct project todos to Inbox
          const todos = (await db.todos.listByProject(project.id)).filter((t) => !t.archived);
          for (const t of todos) await db.todos.put({ ...t, projectId: null });

          // Delete subprojects + remaining todos
          await deleteProjectRecursive(db, project.id);
          onChange?.();
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

          await deleteProjectRecursive(db, project.id);
          onChange?.();
          return true;
        }
      }
    ]
  });
}

export function openProjectMenu(modalHost, { db, project, onChange }) {
  const editBtn = el('button', { class: 'btn', type: 'button' }, 'Edit');
  const deleteBtn = el('button', { class: 'btn btn--danger', type: 'button' }, 'Delete');

  editBtn.addEventListener('click', () => openEditProject(modalHost, { db, project, onChange }));
  deleteBtn.addEventListener('click', () => openDeleteProject(modalHost, { db, project, onChange }));

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
