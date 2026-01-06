import { el, clear, emptyState } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { confirm } from '../ui/confirm.js';
import { newProject } from '../data/models.js';
import { hapticLight, hapticSelection } from '../ui/haptic.js';
import { scheduleChecklistReminder } from '../notifications.js';

export async function renderProjects(ctx) {
  const { main, db, modalHost } = ctx;
  clear(main);

  // List all projects but filter to show only top-level (parentId == null)
  const allProjects = await db.projects.list();
  const projects = allProjects.filter(p => !p.parentId);

  // Normalize sortOrder: older projects (created before reordering was added) 
  // used ISO strings. We want to sort by that if numbers aren't set.
  projects.sort((a, b) => {
    // If both are numbers, compare numbers
    if (typeof a.sortOrder === 'number' && typeof b.sortOrder === 'number') {
      return a.sortOrder - b.sortOrder;
    }
    // Fallback to string comparison (ISO dates work fine)
    if (a.sortOrder < b.sortOrder) return -1;
    if (a.sortOrder > b.sortOrder) return 1;
    return 0;
  });

  // Get todo counts for each project
  const projectStats = new Map();
  for (const p of projects) {
    const todos = await db.todos.listByProject(p.id);
    const nonArchived = todos.filter((t) => !t.archived);
    const total = nonArchived.length;
    const completed = nonArchived.filter(t => t.completed).length;
    const active = total - completed;
    projectStats.set(p.id, { total, completed, active });
  }

  const list = el('div', { class: 'list' });
  
  // Drag & Drop state
  let pointerId = null;
  let dragged = null;
  let placeholder = null;
  let startY = 0;
  let offsetY = 0;
  let rect;
  let started = false;
  let ignoreClick = false; // Flag to prevent click after drag
  const threshold = 5;

  const cleanup = () => {
    if (dragged) {
      dragged.classList.remove('todo--dragging');
      dragged.style.width = '';
      dragged.style.left = '';
      dragged.style.top = '';
      dragged.style.height = ''; 
    }
    if (placeholder) placeholder.remove();
    pointerId = null;
    dragged = null;
    placeholder = null;
    started = false;
  };

  const cardFromEvent = (e) => e.target.closest('.projectCard');
  const isInteractive = (el) => ['BUTTON', 'INPUT', 'A'].includes(el.tagName) || el.closest('.projectCard__menuBtn');

  list.addEventListener('pointerdown', (e) => {
    if (pointerId != null) return;
    const card = cardFromEvent(e);
    if (!card) return;
    if (isInteractive(e.target)) return;

    pointerId = e.pointerId;
    dragged = card;
    startY = e.clientY;
    ignoreClick = false; // Reset flag
    rect = dragged.getBoundingClientRect();
    offsetY = e.clientY - rect.top;
    try { dragged.setPointerCapture(pointerId); } catch { /* ignore */ }
  });

  list.addEventListener('pointermove', (e) => {
    if (pointerId == null || e.pointerId !== pointerId || !dragged) return;

    const dy = e.clientY - startY;
    if (!started && Math.abs(dy) < threshold) return;

    if (!started) {
      started = true;
      ignoreClick = true; // Mark as drag to prevent click
      hapticSelection();
      placeholder = el('div', { class: 'projectCard', style: 'border: 1px dashed var(--border); background: transparent; opacity: 0.5;' });
      placeholder.style.height = `${rect.height}px`;
      dragged.parentNode.insertBefore(placeholder, dragged.nextSibling);

      dragged.classList.add('todo--dragging');
      dragged.style.width = `${rect.width}px`;
      dragged.style.left = `${rect.left}px`;
      dragged.style.top = `${rect.top}px`;
      dragged.style.height = `${rect.height}px`; // Fix height while dragging
      dragged.style.boxSizing = 'border-box';
    }

    e.preventDefault();
    dragged.style.top = `${e.clientY - offsetY}px`;

    // Swap logic
    const cards = Array.from(list.children).filter(c => c !== dragged && c !== placeholder && c.classList.contains('projectCard'));
    
    // Find where to insert placeholder
    const y = e.clientY;
    let inserted = false;
    for (const card of cards) {
      const r = card.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      if (y < mid) {
        if (placeholder !== card.previousSibling) {
            hapticSelection();
            list.insertBefore(placeholder, card);
        }
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      const last = cards[cards.length - 1];
      if (last && last.nextSibling !== placeholder) {
          hapticSelection();
          list.insertBefore(placeholder, last.nextSibling);
      } else if (!last) {
          // List empty? (won't happen if dragging one)
          list.appendChild(placeholder);
      }
    }
  }, { passive: false });

  list.addEventListener('pointerup', async (e) => {
    if (pointerId == null || e.pointerId !== pointerId || !dragged) return;
    
    dragged.releasePointerCapture(pointerId);

    const wasStarted = started; // Capture state

    if (wasStarted && placeholder) {
      hapticLight();
      list.insertBefore(dragged, placeholder);
    }

    cleanup();

    if (wasStarted) {
       // Persist order
       const newOrder = Array.from(list.children)
           .filter(c => c.dataset.projectId)
           .map(c => c.dataset.projectId);
       
       for(let i=0; i<newOrder.length; i++) {
           const pid = newOrder[i];
           const p = projects.find(x => x.id === pid);
           if (p && p.sortOrder !== i) {
               p.sortOrder = i;
               await db.projects.put(p);
           }
       }
       
       // Keep ignoreClick true for a short moment to ensure click is skipped
       setTimeout(() => { ignoreClick = false; }, 100);
    }
  });
  
  list.addEventListener('pointercancel', (e) => {
     if (pointerId == null || e.pointerId !== pointerId) return;
     if (started && placeholder && dragged) {
         list.insertBefore(dragged, placeholder);
     }
     cleanup();
  });

  projects.forEach((p) => {
      const stats = projectStats.get(p.id) || { total: 0, completed: 0, active: 0 };
      const projectType = p.type || 'default';
      const progress = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;

      const card = el('div', {
        class: 'projectCard',
        // Make sure it's relative for absolute positioning of bar
        style: { position: 'relative' },
        dataset: { type: projectType, projectId: p.id },
        onClick: (e) => {
          if (e.target.closest('.projectCard__menuBtn')) return;
          if (ignoreClick) return; // Prevent click if dragged
          if (Math.abs(e.clientY - startY) > 5) return; // Fallback check
          hapticLight();
          location.hash = `#project/${p.id}`;
        },
        'aria-label': `Open project ${p.name}`
      },
        el('div', { class: 'projectCard__row' },
          el('div', { class: 'projectCard__info' },
            el('span', { class: 'projectCard__name' }, p.name),
             stats.active > 0 
                ? el('span', { class: 'projectCard__count' }, `${stats.active} active`) 
                : (stats.total > 0 ? el('span', { class: 'projectCard__count' }, `Done`) : null)
          ),
          p.protected ? el('span', { class: 'icon-protected', 'aria-label': 'Protected' }, '🔒') : null,
          el('button', {
            type: 'button',
            class: 'projectCard__menuBtn iconBtn',
            'aria-label': 'Project options',
            onClick: (e) => { e.stopPropagation(); hapticLight(); openProjectMenu(p); }
          }, '⋯')
        ),
        // Progress Bar
        stats.total > 0 ? el('div', { 
            class: 'projectCard__progress', 
            style: { width: `${progress}%` } 
        }) : null
      );
      list.appendChild(card);
    });

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

export function openCreateProject({ db, modalHost, onCreated, parentId = null }) {
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
          const project = newProject({ name, type, parentId });
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
