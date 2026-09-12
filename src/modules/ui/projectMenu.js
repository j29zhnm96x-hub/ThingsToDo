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
  const mergeDuplicatesInput = el('input', { type: 'checkbox', checked: project.mergeDuplicates ? 'checked' : null, 'aria-label': t('mergeDuplicates') || 'Merge duplicates' });
  const autoLinkInput = el('input', { type: 'checkbox', checked: project.autoLinkInbox ? 'checked' : null, 'aria-label': t('autoLinkInbox') || 'Auto-link to Inbox' });

  const defaultUnits = [
    { value: '', label: t('defaultUnitNone') || 'None' },
    { value: 'pcs', label: t('unitPcs') },
    { value: 'kg', label: t('unitKg') },
    { value: 'g', label: t('unitGram') },
    { value: 'l', label: t('unitLit') },
    { value: 'ml', label: t('unitMl') },
    { value: 'pack', label: t('unitPack') },
    { value: 'box', label: t('unitBox') },
    { value: 'm', label: t('unitMetre') },
    { value: 'cm', label: t('unitCm') }
  ];
  const defaultUnitSelect = el('select', { class: 'select', 'aria-label': t('defaultUnit') || 'Default unit' },
    ...defaultUnits.map(u => el('option', { value: u.value, selected: project.defaultUnit === u.value ? 'selected' : null }, u.label))
  );
  const defaultUnitRow = el('label', { class: 'label', style: project.type === 'checklist' && project.enableQtyUnits ? '' : 'display:none;' },
    el('span', {}, t('defaultUnit') || 'Default unit'),
    defaultUnitSelect
  );

  qtyUnitsInput.addEventListener('change', () => {
    defaultUnitRow.style.display = qtyUnitsInput.checked ? '' : 'none';
  });

  // Automatic reset interval (checklist only)
  const resetIntervalSelect = el('select', { class: 'select', 'aria-label': t('resetInterval') || 'Reset interval' },
    el('option', { value: '', selected: !project.resetInterval ? 'selected' : null }, t('resetNever') || 'Never'),
    el('option', { value: 'daily', selected: project.resetInterval === 'daily' ? 'selected' : null }, t('resetDaily') || 'Daily'),
    el('option', { value: 'weekly', selected: project.resetInterval === 'weekly' ? 'selected' : null }, t('resetWeekly') || 'Weekly'),
    el('option', { value: 'monthly', selected: project.resetInterval === 'monthly' ? 'selected' : null }, t('resetMonthly') || 'Monthly')
  );
  const resetIntervalRow = el('label', { class: 'label', style: project.type === 'checklist' ? '' : 'display:none;' },
    el('span', {}, t('resetInterval') || 'Reset interval'),
    resetIntervalSelect
  );

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const resetDaySelect = el('select', { class: 'select', 'aria-label': t('resetDay') || 'Reset day' });
  const resetDayRow = el('label', { class: 'label', style: 'display:none;' },
    el('span', {}, t('resetDay') || 'Reset day'),
    resetDaySelect
  );

  const fillResetDayOptions = () => {
    resetDaySelect.innerHTML = '';
    if (resetIntervalSelect.value === 'weekly') {
      dayNames.forEach((name, i) => {
        resetDaySelect.appendChild(el('option', { value: String(i), selected: project.resetInterval === 'weekly' && project.resetDay === i ? 'selected' : null }, t(name)));
      });
    } else if (resetIntervalSelect.value === 'monthly') {
      for (let d = 1; d <= 31; d++) {
        resetDaySelect.appendChild(el('option', { value: String(d), selected: project.resetInterval === 'monthly' && project.resetDay === d ? 'selected' : null }, String(d)));
      }
    }
  };

  const updateResetVisibility = () => {
    const interval = resetIntervalSelect.value;
    const showDay = interval === 'weekly' || interval === 'monthly';
    if (showDay) fillResetDayOptions();
    resetDayRow.style.display = showDay ? '' : 'none';
    // Reset interval locks "Keep completed items" on
    if (interval) {
      keepCompletedInput.checked = true;
      keepCompletedInput.disabled = true;
    } else {
      keepCompletedInput.disabled = false;
      keepCompletedInput.checked = project.keepCompletedItems === true;
    }
  };
  resetIntervalSelect.addEventListener('change', updateResetVisibility);
  updateResetVisibility();

  openModal(modalHost, {
    title: t('editProject'),
    content: el('div', { class: 'stack' },
      el('label', { class: 'label' }, el('span', {}, t('name')), input),
      el('label', { class: 'label' }, el('span', {}, t('protectProject')), protectedInput),
      project.type === 'checklist' ? el('label', { class: 'label' }, el('span', {}, t('enableSuggestions')), suggestionsInput) : null,
      project.type === 'checklist' ? el('label', { class: 'label' }, el('span', {}, t('enableQtyUnits')), qtyUnitsInput) : null,
      project.type === 'checklist' ? defaultUnitRow : null,
      project.type === 'checklist' ? el('label', { class: 'label' }, el('span', {}, t('keepCompletedItems')), keepCompletedInput) : null,
      project.type === 'checklist' ? el('label', { class: 'label' }, el('span', {}, t('mergeDuplicates') || 'Merge duplicates'), mergeDuplicatesInput) : null,
      project.type === 'checklist' ? resetIntervalRow : null,
      project.type === 'checklist' ? resetDayRow : null,
      el('label', { class: 'label' }, el('span', {}, t('autoLinkInbox') || 'Auto-link to Inbox'), autoLinkInput)
    ),
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true },
      {
        label: t('save'),
        class: 'btn btn--primary',
        onClick: async () => {
          const name = input.value.trim();
          if (!name) return false;
          const interval = project.type === 'checklist' ? (resetIntervalSelect.value || null) : null;
          const resetDay = interval === 'weekly' || interval === 'monthly'
            ? parseInt(resetDaySelect.value, 10)
            : null;
          await db.projects.put({ ...project, name, protected: protectedInput.checked, useSuggestions: project.type === 'checklist' ? suggestionsInput.checked : false, enableQtyUnits: project.type === 'checklist' ? qtyUnitsInput.checked : false, defaultUnit: project.type === 'checklist' && qtyUnitsInput.checked ? defaultUnitSelect.value || null : null, keepCompletedItems: project.type === 'checklist' ? (interval ? true : keepCompletedInput.checked) : false, mergeDuplicates: project.type === 'checklist' ? mergeDuplicatesInput.checked : false, resetInterval: interval, resetDay, autoLinkInbox: autoLinkInput.checked });
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

  if (project.autoLinkInbox) {
    linkBtn.disabled = true;
    linkBtn.textContent = t('autoLinkManaged') || 'Auto-managed';
    linkBtn.style.opacity = '0.55';
  }

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

export function openInboxProjectMenu(modalHost, { db, project, onChange }) {
  const linkBtn = el('button', { class: 'btn', type: 'button' }, project.showInInbox ? t('unlinkFromInbox') : t('linkToInbox'));

  if (project.autoLinkInbox) {
    linkBtn.disabled = true;
    linkBtn.textContent = t('autoLinkManaged') || 'Auto-managed';
    linkBtn.style.opacity = '0.55';
  }

  let modalRef = null;
  linkBtn.addEventListener('click', async () => {
    const wasLinked = project.showInInbox;
    await db.projects.put({ ...project, showInInbox: !project.showInInbox });
    onChange?.();
    if (modalRef) modalRef.close();
    const message = wasLinked ? t('projectUnlinkedFromInbox') : t('projectLinkedToInbox');
    showToast(message);
  });

  modalRef = openModal(modalHost, {
    title: project.name,
    content: el('div', { class: 'stack' },
      linkBtn
    ),
    actions: [{ label: t('cancel'), class: 'btn btn--ghost', onClick: () => true }]
  });
}
