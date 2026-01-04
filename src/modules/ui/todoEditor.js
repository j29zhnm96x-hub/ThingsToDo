import { el, formatDateInput, toIsoDateOrNull } from './dom.js';
import { openModal } from './modal.js';
import { confirm } from './confirm.js';
import { newAttachment, newTodo, Priority, nowIso } from '../data/models.js';
import { compareTodos, maxOrderFor } from '../logic/sorting.js';

function priorityOptions(select, value) {
  const opts = [Priority.P0, Priority.P1, Priority.P2, Priority.P3];
  const labels = {
    [Priority.P0]: 'Highest',
    [Priority.P1]: 'High',
    [Priority.P2]: 'Medium',
    [Priority.P3]: 'Low'
  };
  for (const p of opts) {
    const o = el('option', { value: p }, labels[p] || p);
    select.appendChild(o);
  }
  select.value = value || Priority.P2;
}

function revokeAll(urls) {
  for (const u of urls) URL.revokeObjectURL(u);
}

export async function openTodoEditor({
  mode, // 'create' | 'edit'
  modalHost,
  db,
  onChange,
  projectId,
  todoId
}) {
  const isEdit = mode === 'edit';
  const existing = isEdit ? await db.todos.get(todoId) : null;
  const todo = existing ? structuredClone(existing) : newTodo({ title: '', projectId });

  let didSave = false;

  // Load existing attachments for edit
  const existingAttachments = existing ? await db.attachments.listForTodo(existing.id) : [];

  // Track URLs for cleanup
  const objectUrls = [];

  const titleInput = el('input', { class: 'input', required: 'required', value: todo.title, placeholder: 'Todo title', 'aria-label': 'Title' });
  const notesInput = el('textarea', { class: 'textarea', placeholder: 'Notes', 'aria-label': 'Notes' }, todo.notes || '');
  const prioritySelect = el('select', { class: 'select', 'aria-label': 'Priority' });
  priorityOptions(prioritySelect, todo.priority);

  const dueInput = el('input', { class: 'input', type: 'date', value: formatDateInput(todo.dueDate), 'aria-label': 'Due date' });
  const completedInput = el('input', { type: 'checkbox', checked: todo.completed ? 'checked' : null, 'aria-label': 'Completed' });

  // iOS: use file input (camera roll). We keep it simple and reliable.
  const fileInput = el('input', { class: 'input', type: 'file', accept: 'image/*', multiple: 'multiple', 'aria-label': 'Attach images' });

  const thumbGrid = el('div', { class: 'thumbGrid', 'aria-label': 'Image attachments' });

  function renderThumbs() {
    thumbGrid.innerHTML = '';
    const all = [...existingAttachments];
    for (const att of all) {
      const url = URL.createObjectURL(att.blob);
      objectUrls.push(url);
      thumbGrid.appendChild(
        el('div', { class: 'thumb' },
          el('img', { src: url, alt: att.name || 'Attachment' }),
          el('button', {
            type: 'button',
            'aria-label': 'Remove image',
            onClick: async () => {
              const ok = await confirm(modalHost, {
                title: 'Remove image?',
                message: 'This will permanently remove the image from this todo.',
                confirmLabel: 'Remove',
                danger: true
              });
              if (!ok) return;
              await db.attachments.delete(att.id);
              const idx = existingAttachments.findIndex((a) => a.id === att.id);
              if (idx >= 0) existingAttachments.splice(idx, 1);
              onChange?.();
              renderThumbs();
            }
          }, '×')
        )
      );
    }
  }

  renderThumbs();

  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;

    // Ensure todo exists before storing blobs.
    if (!isEdit) {
      // Create flow: we delay DB write until save, so we need a stable id now.
      // We already created one in newTodo().
    }

    for (const f of files) {
      const att = newAttachment({ todoId: todo.id, blob: f, name: f.name, type: f.type });
      await db.attachments.put(att);
      existingAttachments.push(att);
    }

    // reset input so selecting same photo again works
    fileInput.value = '';

    onChange?.();
    renderThumbs();
  });

  const content = el('div', { class: 'stack' },
    el('label', { class: 'label' }, el('span', {}, 'Title *'), titleInput),
    el('label', { class: 'label' }, el('span', {}, 'Notes'), notesInput),
    el('div', { class: 'row' },
      el('label', { class: 'label', style: { flex: '1', minWidth: '0' } }, el('span', {}, 'Priority'), prioritySelect),
      el('label', { class: 'label', style: { flex: '1', minWidth: '0' } }, el('span', {}, 'Due date'), dueInput)
    ),
    el('label', { class: 'label' },
      el('span', {}, 'Completed'),
      completedInput
    ),
    el('div', { class: 'hr' }),
    el('label', { class: 'label' }, el('span', {}, 'Add images'), fileInput),
    thumbGrid,
    el('div', { class: 'small' }, 'Images are stored locally in IndexedDB and will persist offline.')
  );

  async function save() {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return false;
    }

    todo.title = title;
    todo.notes = notesInput.value || '';
    todo.priority = prioritySelect.value;
    todo.dueDate = toIsoDateOrNull(dueInput.value);
    todo.completed = !!completedInput.checked;

    // Manual order management:
    // - Default sort: priority -> order -> createdAt
    // - When creating or when changing (container/priority), place at end of that bucket.

    const allActiveInContainer = await db.todos.listByProject(todo.projectId);
    const active = allActiveInContainer.filter((t) => !t.archived);

    if (!isEdit) {
      todo.createdAt = nowIso();
    }

    const priorityChanged = existing ? existing.priority !== todo.priority : true;
    const containerChanged = existing ? existing.projectId !== todo.projectId : true;

    if (!existing || priorityChanged || containerChanged) {
      const max = maxOrderFor(active, { priority: todo.priority });
      todo.order = (Number.isFinite(max) ? max : -1) + 1;
    }

    await db.todos.put(todo);
    didSave = true;
    onChange?.();
    return true;
  }

  async function deleteTodo() {
    const ok = await confirm(modalHost, {
      title: 'Delete todo?',
      message: 'This will permanently delete the todo and its images.',
      confirmLabel: 'Delete',
      danger: true
    });
    if (!ok) return false;

    await db.todos.delete(todo.id);
    onChange?.();
    return true;
  }

  const modal = openModal(modalHost, {
    title: isEdit ? 'Edit Todo' : 'New Todo',
    content,
    actions: [
      isEdit ? { label: 'Delete', class: 'btn btn--danger', onClick: deleteTodo } : null,
      { label: 'Cancel', class: 'btn btn--ghost', onClick: () => true },
      { label: 'Save', class: 'btn btn--primary', onClick: save }
    ].filter(Boolean),
    onClose: async () => {
      revokeAll(objectUrls);
      // If the user cancels a brand-new todo after adding images, clean them up.
      // Otherwise we’d keep unattached blobs forever.
      if (!isEdit && !didSave) {
        const orphans = await db.attachments.listForTodo(todo.id);
        for (const a of orphans) await db.attachments.delete(a.id);
      }
    }
  });

  // Focus title for fast entry
  requestAnimationFrame(() => titleInput.focus());

  return modal;
}
