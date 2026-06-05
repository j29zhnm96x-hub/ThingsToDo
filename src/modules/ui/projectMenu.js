import { el } from './dom.js';
import { openModal } from './modal.js';
import { confirm } from './confirm.js';
import { showToast } from './toast.js';
import { t } from '../utils/i18n.js';
import { pickDestination, buildPagesMap } from './pickDestination.js';

async function deleteProjectRecursive(db, projectId) {
  const allProjects = await db.projects.list();
  const children = allProjects.filter((p) => p.parentId === projectId);
  for (const child of children) {
    await deleteProjectRecursive(db, child.id);
  }
  const todos = await db.todos.listByProject(projectId);
  for (const todo of todos) {
    await db.todos.delete(todo.id);
  }
  await db.projects.delete(projectId);
}

function openEditProject(modalHost, { db, project, onChange }) {
  const input = el('input', { class: 'input', value: project.name, 'aria-label': t('projectName') });
  const protectedInput = el('input', { type: 'checkbox', checked: project.protected ? 'checked' : null, 'aria-label': t('protectProject') });
  const suggestionsInput = el('input', { type: 'checkbox', checked: project.useSuggestions ? 'checked' : null, 'aria-label': t('useSuggestions') });
  const qtyUnitsInput = el('input', { type: 'checkbox', checked: project.enableQtyUnits ? 'checked' : null, 'aria-label': t('enableQtyUnits') });
  const keepCompletedInput = el('input', { type: 'checkbox', checked: project.keepCompletedItems ? 'checked' : null, 'aria-label': t('keepCompletedItems') });

  openModal(modalHost, {
    title: t('editProject'),
    content: el('div', { class: 'stack' },
      el('label', { class: 'label' }, el('span', {}, t('name')), input),
      el('label', { class: 'label' }, el('span', {}, t('protectProject')), protectedInput),
      project.type === 'checklist' ? el('label', { class: 'label' }, el('span', {}, t('enableSuggestions')), suggestionsInput) : null,
      project.type === 'checklist' ? el('label', { class: 'label' }, el('span', {}, t('enableQtyUnits')), qtyUnitsInput) : null,
      project.type === 'checklist' ? el('label', { class: 'label' }, el('span', {}, t('keepCompletedItems')), keepCompletedInput) : null
    ),
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true },
      {
        label: t('save'),
        class: 'btn btn--primary',
        onClick: async () => {
          const name = input.value.trim();
          if (!name) return false;
          await db.projects.put({ ...project, name, protected: protectedInput.checked, useSuggestions: project.type === 'checklist' ? suggestionsInput.checked : false, enableQtyUnits: project.type === 'checklist' ? qtyUnitsInput.checked : false, keepCompletedItems: project.type === 'checklist' ? keepCompletedInput.checked : false });
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
      title: t('projectProtected'),
      content: el('div', {}, t('projectProtectedMsg')),
      actions: [{ label: t('ok'), class: 'btn btn--primary', onClick: () => true }]
    });
    return;
  }

  const content = el('div', { class: 'stack' },
    el('div', { class: 'small' }, t('deleteProjectMsg')),
    el('div', { class: 'small' }, t('deleteProjectOption1')),
    el('div', { class: 'small' }, t('deleteProjectOption2'))
  );

  openModal(modalHost, {
    title: t('deleteProject') + ' "' + project.name + '"?',
    content,
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true },
      {
        label: t('deleteProjectMove'),
        class: 'btn btn--danger',
        onClick: async () => {
          const ok = await confirm(modalHost, {
            title: t('confirmDelete'),
            message: t('deleteProjectMoveConfirm'),
            confirmLabel: t('delete'),
            danger: true
          });
          if (!ok) return false;

          const todos = (await db.todos.listByProject(project.id)).filter((t) => !t.archived);
          for (const t of todos) await db.todos.put({ ...t, projectId: null });

          await deleteProjectRecursive(db, project.id);
          onChange?.();
          return true;
        }
      },
      {
        label: t('deleteProjectArchive'),
        class: 'btn btn--danger',
        onClick: async () => {
          const ok = await confirm(modalHost, {
            title: t('confirmDelete'),
            message: t('deleteProjectArchiveConfirm'),
            confirmLabel: t('deleteProjectArchive'),
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
            await compressAttachmentsForArchive(db, t.id);
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
  const editBtn = el('button', { class: 'btn', type: 'button' }, t('edit'));
  const shareBtn = el('button', { class: 'btn', type: 'button' }, t('share'));
  const linkBtn = el('button', { class: 'btn', type: 'button' }, project.showInInbox ? t('unlinkFromInbox') : t('linkToInbox'));
  const moveBtn = el('button', { class: 'btn', type: 'button' }, t('move'));
  const deleteBtn = el('button', { class: 'btn btn--danger', type: 'button' }, t('delete'));

  editBtn.addEventListener('click', () => openEditProject(modalHost, { db, project, onChange }));
  shareBtn.addEventListener('click', async () => {
    try {
      const { exportProjectToFile } = await import('../utils/share.js');
      await exportProjectToFile(db, project);
      if (modalRef) modalRef.close();
    } catch (e) {
      console.error('Project export failed', e);
    }
  });
  
  let modalRef = null;
  linkBtn.addEventListener('click', async () => {
    const wasLinked = project.showInInbox;
    await db.projects.put({ ...project, showInInbox: !project.showInInbox });
    onChange?.();
    if (modalRef) modalRef.close();
    const message = wasLinked ? t('projectUnlinkedFromInbox') : t('projectLinkedToInbox');
    showToast(message);
  });
  
  deleteBtn.addEventListener('click', () => openDeleteProject(modalHost, { db, project, onChange }));

  moveBtn.addEventListener('click', async () => {
    const allProjects = await db.projects.list();
    const pagesByProjectId = await buildPagesMap(db);
    const dest = await pickDestination(modalHost, {
      projects: allProjects.filter(p => p.id !== project.id),
      pagesByProjectId,
      initial: { projectId: null, pageId: null },
      includeInbox: false
    });
    if (!dest) return;
    await db.projects.put({ ...project, parentId: dest.projectId });
    onChange?.();
    if (modalRef) modalRef.close();
    showToast(t('projectMoved') || 'Project moved');
  });

  modalRef = openModal(modalHost, {
    title: project.name,
    content: el('div', { class: 'stack' },
      el('div', { class: 'small' }, t('actions')),
      editBtn,
      shareBtn,
      linkBtn,
      moveBtn,
      deleteBtn
    ),
    actions: [{ label: t('close'), class: 'btn btn--ghost', onClick: () => true }]
  });
}
