import { el, formatDateInput, toIsoDateOrNull } from './dom.js';
import { openModal } from './modal.js';
import { confirm } from './confirm.js';
import { newAttachment, newTodo, Priority, nowIso, generateId } from '../data/models.js';
import { maxOrderFor } from '../logic/sorting.js';
import { compressImageBlob, createThumbnailBlob } from '../utils/image.js';
import { t } from '../utils/i18n.js';
import { createNextRecurringInstance } from '../logic/recurrence.js';

const EDIT_COMPRESS_SPEC = { maxSize: 1280, quality: 0.8 };
const THUMB_COMPRESS_SPEC = { maxSize: 320, quality: 0.6 };

function priorityOptions(select, value) {
  const opts = [Priority.URGENT, Priority.P0, Priority.P1, Priority.P2, Priority.P3];
  const labels = {
    [Priority.URGENT]: t('urgent'),
    [Priority.P0]: t('highest'),
    [Priority.P1]: t('high'),
    [Priority.P2]: t('medium'),
    [Priority.P3]: t('low')
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

  const titleInput = el('input', { class: 'input', required: 'required', value: todo.title, placeholder: t('taskTitle'), 'aria-label': t('title') });
  const notesInput = el('textarea', { class: 'textarea', placeholder: t('taskNotes'), 'aria-label': t('notes') }, todo.notes || '');
  const prioritySelect = el('select', { class: 'select', 'aria-label': t('priority') });
  priorityOptions(prioritySelect, todo.priority);

  const dueInput = el('input', { class: 'input', type: 'date', value: formatDateInput(todo.dueDate), 'aria-label': t('dueDate') });
  const completedInput = el('input', { type: 'checkbox', checked: todo.completed ? 'checked' : null, 'aria-label': t('completed') });
  const protectedInput = el('input', { type: 'checkbox', checked: todo.protected ? 'checked' : null, 'aria-label': t('protectTask') });

  // --- Recurrence UI ---
  const recurrenceSelect = el('select', { class: 'select', 'aria-label': t('repeat') || 'Repeat' });
  const recurrenceOptions = [
    { value: '', label: t('none') || 'None' },
    { value: 'daily', label: t('daily') || 'Daily' },
    { value: 'weekly', label: t('weekly') || 'Weekly' },
    { value: 'monthly', label: t('monthly') || 'Monthly' },
    { value: 'yearly', label: t('yearly') || 'Yearly' }
  ];
  for (const opt of recurrenceOptions) {
    recurrenceSelect.appendChild(el('option', { value: opt.value }, opt.label));
  }
  recurrenceSelect.value = todo.recurrenceType || '';

  // Weekly days selector (Mon-Sun toggles)
  const weeklyDaysContainer = el('div', { class: 'recurrence-weekly-days', style: { display: 'none' } });
  const dayLabels = [
    t('sun') || 'S', t('mon') || 'M', t('tue') || 'T', 
    t('wed') || 'W', t('thu') || 'T', t('fri') || 'F', t('sat') || 'S'
  ];
  const dayButtons = [];
  const selectedDays = new Set(todo.recurrenceDetails?.days || []);
  
  for (let i = 0; i < 7; i++) {
    const isSelected = selectedDays.has(i);
    const btn = el('button', {
      type: 'button',
      class: `recurrence-day-btn ${isSelected ? 'recurrence-day-btn--active' : ''}`,
      'data-day': i,
      onClick: () => {
        if (selectedDays.has(i)) {
          selectedDays.delete(i);
          btn.classList.remove('recurrence-day-btn--active');
        } else {
          selectedDays.add(i);
          btn.classList.add('recurrence-day-btn--active');
        }
      }
    }, dayLabels[i]);
    dayButtons.push(btn);
    weeklyDaysContainer.appendChild(btn);
  }

  // Monthly options
  const monthlyOptionsContainer = el('div', { class: 'recurrence-monthly-options', style: { display: 'none' } });
  const monthlyTypeSelect = el('select', { class: 'select select--small', 'aria-label': t('monthlyType') || 'Monthly type' });
  monthlyTypeSelect.appendChild(el('option', { value: 'date' }, t('sameDate') || 'Same date'));
  monthlyTypeSelect.appendChild(el('option', { value: 'weekday' }, t('nthWeekday') || 'Nth weekday'));
  monthlyTypeSelect.value = todo.recurrenceDetails?.type || 'date';
  monthlyOptionsContainer.appendChild(monthlyTypeSelect);

  // End condition
  const endContainer = el('div', { class: 'recurrence-end', style: { display: 'none' } });
  const endTypeSelect = el('select', { class: 'select select--small', 'aria-label': t('endAfter') || 'End after' });
  endTypeSelect.appendChild(el('option', { value: 'never' }, t('never') || 'Never'));
  endTypeSelect.appendChild(el('option', { value: 'date' }, t('onDate') || 'On date'));
  endTypeSelect.appendChild(el('option', { value: 'occurrences' }, t('afterTimes') || 'After X times'));
  endTypeSelect.value = todo.recurrenceEndType || 'never';
  
  const endDateInput = el('input', { 
    class: 'input input--small', 
    type: 'date', 
    value: todo.recurrenceEndType === 'date' ? formatDateInput(todo.recurrenceEndValue) : '',
    style: { display: todo.recurrenceEndType === 'date' ? 'block' : 'none' }
  });
  
  const endOccurrencesInput = el('input', { 
    class: 'input input--small', 
    type: 'number', 
    min: '1', 
    max: '999',
    value: todo.recurrenceEndType === 'occurrences' ? (todo.recurrenceEndValue || '5') : '5',
    placeholder: '5',
    style: { display: todo.recurrenceEndType === 'occurrences' ? 'block' : 'none', width: '80px' }
  });

  endTypeSelect.addEventListener('change', () => {
    endDateInput.style.display = endTypeSelect.value === 'date' ? 'block' : 'none';
    endOccurrencesInput.style.display = endTypeSelect.value === 'occurrences' ? 'block' : 'none';
  });

  endContainer.append(
    el('span', { class: 'small', style: { marginRight: '8px' } }, t('ends') || 'Ends:'),
    endTypeSelect,
    endDateInput,
    endOccurrencesInput
  );

  // Recurrence details container (shown when recurrence is selected)
  const recurrenceDetailsContainer = el('div', { class: 'recurrence-details', style: { display: 'none' } },
    weeklyDaysContainer,
    monthlyOptionsContainer,
    endContainer
  );

  // Show/hide recurrence details based on type
  function updateRecurrenceUI() {
    const type = recurrenceSelect.value;
    const hasRecurrence = !!type;
    
    recurrenceDetailsContainer.style.display = hasRecurrence ? 'block' : 'none';
    weeklyDaysContainer.style.display = type === 'weekly' ? 'flex' : 'none';
    monthlyOptionsContainer.style.display = (type === 'monthly' || type === 'yearly') ? 'block' : 'none';
    endContainer.style.display = hasRecurrence ? 'flex' : 'none';
  }
  
  recurrenceSelect.addEventListener('change', updateRecurrenceUI);
  updateRecurrenceUI(); // Initial state

  // iOS: use file input (camera roll). We keep it simple and reliable.
  const fileInput = el('input', { class: 'input', type: 'file', accept: 'image/*', multiple: 'multiple', 'aria-label': t('addImages'), style: { display: 'none' } });
  const fileButton = el('button', { type: 'button', class: 'btn btn--primary', style: { padding: '0.75rem 1.5rem' } }, t('chooseFile'));
  const fileStatusLabel = el('span', { style: { marginLeft: '1rem' } }, t('noFilesSelected'));
  const fileInputWrapper = el('div', { style: { display: 'flex', alignItems: 'center', width: '100%' } }, fileButton, fileStatusLabel);
  
  fileButton.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const fileCount = fileInput.files?.length || 0;
    if (fileCount === 0) {
      fileStatusLabel.textContent = t('noFilesSelected');
    } else if (fileCount === 1) {
      fileStatusLabel.textContent = t('fileSelected', { n: 1 });
    } else {
      fileStatusLabel.textContent = t('filesSelected', { n: fileCount });
    }
  });

  const thumbGrid = el('div', { class: 'thumbGrid', 'aria-label': 'Image attachments' });

  function renderThumbs() {
    thumbGrid.innerHTML = '';
    const all = [...existingAttachments];
    for (const att of all) {
      const previewBlob = att.thumb || att.blob;
      const url = URL.createObjectURL(previewBlob);
      objectUrls.push(url);
      thumbGrid.appendChild(
        el('div', { class: 'thumb' },
          el('img', { src: url, alt: att.name || 'Attachment', loading: 'lazy', decoding: 'async' }),
          el('button', {
            type: 'button',
            class: 'thumb__removeBtn',
            'aria-label': t('removeImage'),
            title: t('removeImageHint'),
            onClick: async () => {
              const ok = await confirm(modalHost, {
                title: t('removeImage') + '?',
                message: t('deleteConfirmMsg'),
                confirmLabel: t('delete'),
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
    // Update file status label
    const fileCount = fileInput.files?.length || 0;
    if (fileCount === 0) {
      fileStatusLabel.textContent = t('noFilesSelected');
    } else {
      fileStatusLabel.textContent = fileCount === 1 ? '1 file' : `${fileCount} files`;
    }
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;

    // Ensure todo exists before storing blobs.
    if (!isEdit) {
      // Create flow: we delay DB write until save, so we need a stable id now.
      // We already created one in newTodo().
    }

    const settings = await db.settings.get();
    const shouldCompress = settings.compressImages !== false;

    for (const f of files) {
      const isImage = typeof f.type === 'string' && f.type.startsWith('image/');
      let blob = f;
      if (isImage && shouldCompress) {
        try {
          blob = await compressImageBlob(f, EDIT_COMPRESS_SPEC);
        } catch (e) {
          console.error('Compression failed', e);
        }
      }

      let thumb = null;
      if (isImage) {
        try {
          thumb = await createThumbnailBlob(blob, THUMB_COMPRESS_SPEC);
        } catch (e) {
          console.error('Thumbnail failed', e);
        }
      }
      
      const att = newAttachment({ todoId: todo.id, blob, name: f.name, type: blob.type || f.type, thumb });
      await db.attachments.put(att);
      existingAttachments.push(att);
    }

    // reset input so selecting same photo again works
    fileInput.value = '';

    onChange?.();
    renderThumbs();
  });

  const content = el('div', { class: 'stack' },
    el('label', { class: 'label' }, el('span', {}, t('titleRequired')), titleInput),
    el('label', { class: 'label' }, el('span', {}, t('notes')), notesInput),
    el('div', { class: 'row row--split' },
      el('label', { class: 'label' }, el('span', {}, t('priority')), prioritySelect),
      el('label', { class: 'label' }, el('span', {}, t('dueDate')), dueInput)
    ),
    el('label', { class: 'label' }, el('span', {}, t('repeat') || 'Repeat'), recurrenceSelect),
    recurrenceDetailsContainer,
    el('label', { class: 'label' },
      el('span', {}, t('completed')),
      completedInput
    ),
    el('label', { class: 'label' },
      el('span', {}, t('protectTask')),
      protectedInput
    ),
    el('div', { class: 'small', style: { marginTop: '-0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)' } }, 
      t('protectedTasksInfo')
    ),
    el('div', { class: 'hr' }),
    el('label', { class: 'label' }, el('span', {}, t('addImages')), fileInputWrapper),
    thumbGrid,
    el('div', { class: 'small' }, t('imagesStoredInfo'))
  );

  async function save() {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return false;
    }

    // Validate: recurring tasks need a due date
    const recurrenceType = recurrenceSelect.value || null;
    const dueDate = toIsoDateOrNull(dueInput.value);
    
    if (recurrenceType && !dueDate) {
      openModal(modalHost, {
        title: t('dueDateRequired') || 'Due Date Required',
        content: el('div', {}, t('recurringNeedsDueDate') || 'Recurring tasks need a due date to calculate the next occurrence.'),
        actions: [{ label: t('ok') || 'OK', class: 'btn btn--primary', onClick: () => true }]
      });
      dueInput.focus();
      return false;
    }

    todo.title = title;
    todo.notes = notesInput.value || '';
    todo.priority = prioritySelect.value;
    todo.dueDate = dueDate;
    todo.completed = !!completedInput.checked;
    todo.protected = !!protectedInput.checked;

    // Recurrence settings
    todo.recurrenceType = recurrenceType;
    
    if (recurrenceType) {
      // Build recurrence details based on type
      const details = {};
      
      if (recurrenceType === 'weekly') {
        details.days = Array.from(selectedDays).sort((a, b) => a - b);
      } else if (recurrenceType === 'monthly' || recurrenceType === 'yearly') {
        details.type = monthlyTypeSelect.value || 'date';
        if (details.type === 'date') {
          details.value = dueDate ? new Date(dueDate).getDate() : 1;
        } else {
          // Calculate nth weekday from due date
          const d = dueDate ? new Date(dueDate) : new Date();
          details.value = d.getDay(); // Weekday (0-6)
          details.weekdayOrdinal = Math.ceil(d.getDate() / 7); // Which occurrence (1st, 2nd, etc.)
          if (recurrenceType === 'yearly') {
            details.month = d.getMonth();
          }
        }
      }
      
      todo.recurrenceDetails = details;
      todo.recurrenceEndType = endTypeSelect.value || 'never';
      
      if (todo.recurrenceEndType === 'date') {
        todo.recurrenceEndValue = toIsoDateOrNull(endDateInput.value);
      } else if (todo.recurrenceEndType === 'occurrences') {
        todo.recurrenceEndValue = parseInt(endOccurrencesInput.value, 10) || 5;
      } else {
        todo.recurrenceEndValue = null;
      }
      
      // Assign series ID if new recurring task
      if (!todo.seriesId) {
        todo.seriesId = generateId();
      }
    } else {
      // Clear recurrence if set to none
      todo.recurrenceDetails = null;
      todo.recurrenceEndType = 'never';
      todo.recurrenceEndValue = null;
      todo.seriesId = null;
      todo.recurrenceCount = 0;
    }

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
    if (todo.protected) {
      openModal(modalHost, {
        title: t('taskProtected'),
        content: el('div', {}, t('taskProtectedMsg')),
        actions: [{ label: t('ok'), class: 'btn btn--primary', onClick: () => true }]
      });
      return false;
    }

    const ok = await confirm(modalHost, {
      title: t('deleteConfirmTitle'),
      message: t('deleteConfirmMsg'),
      confirmLabel: t('delete'),
      danger: true
    });
    if (!ok) return false;

    await db.todos.delete(todo.id);
    onChange?.();
    return true;
  }

  const modal = openModal(modalHost, {
    title: isEdit ? t('editTodo') : t('newTodo'),
    content,
    align: 'top',
    headerActions: [
      { label: t('save'), class: 'btn btn--primary', onClick: save }
    ],
    actions: [
      isEdit ? { label: t('delete'), class: 'btn btn--danger', onClick: deleteTodo } : null,
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true },
      { label: t('save'), class: 'btn btn--primary', onClick: save }
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

  // Focus title for fast entry (synchronously to trigger keyboard on mobile)
  try { titleInput.focus(); } catch (e) { /* ignore */ }

  return modal;
}
