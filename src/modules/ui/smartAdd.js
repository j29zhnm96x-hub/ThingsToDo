// Smart Add — AI-powered task/project/checklist creation
// Three states: input (type/record) → loading (AI processing) → preview (confirm/create)

import { el } from './dom.js';
import { openModal } from './modal.js';
import { showToast } from './toast.js';
import { t, getLang } from '../utils/i18n.js';
import { router } from '../router.js';
import { buildPrompt, callAI, parseResponse, validateStructure, getSpeechLocale, buildExistingProjectsContext } from '../logic/aiClient.js';
import { tryParse } from '../logic/localParser.js';
import { newTodo, newProject, newChecklistPage, newProjectNote } from '../data/models.js';

let abortController = null;

export async function openSmartAdd(ctx, context) {
  const { modalHost, db } = ctx;
  const settings = await db.settings.get();

  // Capture app language for speech recognition and AI responses
  const appLang = getLang();

  // Check if AI is configured
  if (!settings.aiEnabled || !settings.aiApiKey) {
    showNotConfigured(ctx);
    return;
  }

  let closeModal = null;
  let currentState = 'input';
  let recognition = null;
  let isListening = false;

  // --- State 1: Input ---
  const textarea = el('textarea', {
    class: 'input',
    style: { width: '100%', minHeight: '120px', resize: 'vertical', padding: '12px', borderRadius: '12px', boxSizing: 'border-box' },
    placeholder: t('aiInputPlaceholder')
  });

  const micBtn = el('button', {
    type: 'button',
    class: 'btn',
    style: { padding: '12px', minWidth: '48px', fontSize: '20px', lineHeight: '1' },
    'aria-label': t('aiTapToSpeak'),
    title: t('aiTapToSpeak'),
    onClick: toggleMicrophone
  }, '🎤');

  const micStatus = el('span', { class: 'small', style: { flex: '1', color: 'var(--muted)' } }, '');

  const generateBtn = el('button', {
    type: 'button',
    class: 'btn btn--primary',
    disabled: true,
    onClick: startGeneration
  }, t('aiGenerate'));

  // Enable generate when text is entered
  textarea.addEventListener('input', () => {
    generateBtn.disabled = !textarea.value.trim();
  });

  const inputContent = el('div', { class: 'stack', style: { gap: '12px' } },
    el('div', { class: 'small', style: { color: 'var(--muted)' } }, t('aiSmartAddDesc')),
    textarea,
    el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
      micBtn,
      micStatus,
      el('div', { style: { flex: '1' } }),
      generateBtn
    )
  );

  async function buildContextInfo() {
    const base = { lang: appLang };
    const existingProjects = await buildExistingProjectsContext(db);
    if (context.mode === 'inbox') {
      return { ...base, mode: 'inbox', existingProjects };
    } else if (context.mode === 'project') {
      return {
        ...base,
        mode: 'project',
        projectName: context.project.name,
        projectType: context.project.type || 'default',
        existingProjects
      };
    } else if (context.mode === 'checklist') {
      return {
        ...base,
        mode: 'checklist',
        projectName: context.project.name,
        pageName: context.pageName || 'Untitled',
        existingProjects
      };
    }
    return { ...base, mode: 'inbox', existingProjects };
  }

  function toggleMicrophone() {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  }

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast(t('aiMicrophoneNotSupported'));
      return;
    }

    try {
      recognition = new SpeechRecognition();
      recognition.lang = getLangForSpeech();
      recognition.interimResults = true;
      recognition.continuous = true;

      // Track final results separately so long speech accumulates instead of overwriting
      let finalTranscript = '';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        textarea.value = (finalTranscript + interimTranscript).trim();
        textarea.dispatchEvent(new Event('input'));
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          showToast(t('aiMicrophoneDenied'));
        }
        stopListening();
      };

      recognition.onend = () => {
        if (isListening) stopListening();
      };

      recognition.start();
      isListening = true;
      micBtn.textContent = '⏹';
      micBtn.style.borderColor = 'var(--danger)';
      micStatus.textContent = t('aiListening');
    } catch (err) {
      showToast(t('aiMicrophoneNotSupported'));
    }
  }

  function stopListening() {
    isListening = false;
    if (recognition) {
      try { recognition.stop(); } catch {}
      recognition = null;
    }
    micBtn.textContent = '🎤';
    micBtn.style.borderColor = '';
    micStatus.textContent = '';
  }

  function getLangForSpeech() {
    return getSpeechLocale(appLang);
  }

  // --- State 2: Loading ---
  function showLoading() {
    currentState = 'loading';
    abortController = new AbortController();
    clearContent(loadingContent);
    modalRef?.();
    // Re-open with loading state
    const ref = openModal(modalHost, {
      title: t('aiSmartAdd'),
      align: 'bottom',
      content: loadingContent,
      preventBackdropClose: true,
      onClose: () => {
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
        if (recognition) stopListening();
      }
    });
    closeModal = ref.close;
  }

  const spinner = el('div', { class: 'spinner', style: { margin: '24px auto', width: '32px', height: '32px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' } });
  const loadingLabel = el('div', { class: 'small', style: { textAlign: 'center', color: 'var(--muted)' } }, t('aiGenerating'));
  const cancelLoadingBtn = el('button', {
    type: 'button',
    class: 'btn btn--ghost',
    onClick: () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
      showInput();
    }
  }, t('aiCancel'));

  const loadingContent = el('div', { class: 'stack', style: { gap: '16px', padding: '24px 0', alignItems: 'center' } },
    spinner,
    loadingLabel,
    cancelLoadingBtn
  );

  // --- State 3: Preview ---
  function showPreview(parsed) {
    currentState = 'preview';
    const totalItems = countItems(parsed);
    if (totalItems === 0) {
      showToast(t('aiEmptyResponse'));
      showInput();
      return;
    }

    // Build preview list with checkboxes
    const checkboxes = [];
    const previewItems = [];

    // Tasks
    for (const task of parsed.tasks) {
      const cb = createCheckbox(true);
      checkboxes.push(cb);
      previewItems.push(createPreviewRow(cb, '📄', task.title, t('aiTask'), task.notes));
    }

    // Projects
    for (const proj of parsed.projects) {
      const cb = createCheckbox(true);
      checkboxes.push(cb);
      const sub = [];
      if (proj.tasks.length) sub.push(...proj.tasks.map(t => '  · ' + t.title));
      if (proj.subProjects.length) sub.push(...proj.subProjects.map(sp => '  📁 ' + sp.name + (sp.tasks.length ? ` (${sp.tasks.length} tasks)` : '')));
      if (proj.pages.length) sub.push(...proj.pages.map(p => '  📋 ' + p.name + ` (${p.items.length} items)`));
      previewItems.push(createPreviewRow(cb, '📁', proj.name, t('aiProject'), sub.join('\n'), proj.type === 'checklist' ? 'checklist' : 'project'));
    }

    // Checklist pages (only relevant in checklist mode)
    for (const cp of parsed.checklistPages) {
      const cb = createCheckbox(true);
      checkboxes.push(cb);
      const items = cp.items.map(i => '  · ' + i.title).join('\n');
      previewItems.push(createPreviewRow(cb, '📋', cp.name, t('aiChecklistPage'), items));
    }

    // Add to Project (existing project, add tasks)
    for (const ap of parsed.addToProject) {
      const cb = createCheckbox(true);
      checkboxes.push(cb);
      const sub = ap.tasks.map(t => '  · ' + t.title).join('\n');
      previewItems.push(createPreviewRow(cb, '📌', ap.projectName, '→ ' + t('aiProject'), sub));
    }

    // Add to Checklist Page (existing project+page, add items)
    for (const acp of parsed.addToChecklistPage) {
      const cb = createCheckbox(true);
      checkboxes.push(cb);
      const sub = acp.items.map(i => '  · ' + i.title).join('\n');
      previewItems.push(createPreviewRow(cb, '📌', acp.projectName + ' › ' + acp.pageName, '→ ' + t('aiChecklistPage'), sub));
    }

    // Move tasks
    for (const mt of parsed.moveTasks) {
      const cb = createCheckbox(true);
      checkboxes.push(cb);
      previewItems.push(createPreviewRow(cb, '↗️', mt.taskTitle, '→ ' + mt.targetProject, mt.targetPage ? 'tab: ' + mt.targetPage : ''));
    }

    // Notes
    for (const n of parsed.notes) {
      const cb = createCheckbox(true);
      checkboxes.push(cb);
      previewItems.push(createPreviewRow(cb, '📝', n.text, t('aiNote'), ''));
    }

    const selectAllCb = el('input', { type: 'checkbox', checked: 'checked', 'aria-label': 'Select all' });
    selectAllCb.addEventListener('change', () => {
      const checked = selectAllCb.checked;
      for (const cb of checkboxes) cb.checked = checked;
    });

    const previewContent = el('div', { class: 'stack', style: { gap: '8px' } },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' } },
        selectAllCb,
        el('span', { class: 'small', style: { fontWeight: '600' } }, t('aiItemsFound', { n: totalItems }))
      ),
      el('div', { class: 'stack', style: { gap: '4px', maxHeight: '50vh', overflowY: 'auto' } }, ...previewItems)
    );

    modalRef?.();
    const ref = openModal(modalHost, {
      title: t('aiPreviewTitle'),
      align: 'bottom',
      content: previewContent,
      actions: [
        { label: t('aiCancel'), class: 'btn btn--ghost', onClick: () => { if (recognition) stopListening(); return true; } },
        { label: t('aiCreateSelected'), class: 'btn btn--primary', onClick: async () => {
          const selected = [];
          const cbArray = checkboxes;
          let idx = 0;

          for (const task of parsed.tasks) {
            if (cbArray[idx]?.checked) selected.push({ type: 'task', data: task });
            idx++;
          }
          for (const proj of parsed.projects) {
            if (cbArray[idx]?.checked) selected.push({ type: 'project', data: proj });
            idx++;
          }
          for (const cp of parsed.checklistPages) {
            if (cbArray[idx]?.checked) selected.push({ type: 'checklistPage', data: cp });
            idx++;
          }
          for (const ap of parsed.addToProject) {
            if (cbArray[idx]?.checked) selected.push({ type: 'addToProject', data: ap });
            idx++;
          }
          for (const acp of parsed.addToChecklistPage) {
            if (cbArray[idx]?.checked) selected.push({ type: 'addToChecklistPage', data: acp });
            idx++;
          }
          for (const mt of parsed.moveTasks) {
            if (cbArray[idx]?.checked) selected.push({ type: 'moveTask', data: mt });
            idx++;
          }
          for (const n of parsed.notes) {
            if (cbArray[idx]?.checked) selected.push({ type: 'note', data: n });
            idx++;
          }

          if (selected.length === 0) {
            showToast(t('aiNoInput'));
            return false;
          }

          try {
            await createSelected(ctx, context, selected);
            showToast(t('aiCreated', { n: selected.length }));
            router.refresh();
            return true;
          } catch (err) {
            showToast(t('aiError', { msg: err.message }));
            return false;
          }
        } }
      ]
    });
    closeModal = ref.close;
  }

  function createCheckbox(checked) {
    return el('input', { type: 'checkbox', checked: checked ? 'checked' : null, style: { flexShrink: '0', width: '18px', height: '18px' } });
  }

  function createPreviewRow(checkbox, icon, title, typeLabel, subText, extraClass) {
    const row = el('div', {
      class: 'card' + (extraClass ? ' card--' + extraClass : ''),
      style: { display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', margin: '0' }
    },
      checkbox,
      el('div', { style: { flex: '1', minWidth: '0' } },
        el('div', { style: { fontWeight: '500', fontSize: '14px', wordBreak: 'break-word' } }, icon + ' ' + title),
        el('div', { class: 'small', style: { color: 'var(--muted)' } }, typeLabel),
        subText ? el('div', { class: 'small', style: { color: 'var(--muted)', marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '60px', overflow: 'hidden' } }, subText) : null
      )
    );
    return row;
  }

  function countItems(parsed) {
    return parsed.tasks.length + parsed.projects.length + parsed.checklistPages.length + parsed.notes.length + parsed.addToProject.length + parsed.addToChecklistPage.length + parsed.moveTasks.length;
  }

  function clearContent(content) {
    // no-op — we close and reopen modal instead
  }

  let modalRef = null;

  // --- Main flow: start generation ---
  async function startGeneration() {
    const text = textarea.value.trim();
    if (!text) {
      showToast(t('aiNoInput'));
      return;
    }

    if (recognition) stopListening();

    showLoading();

    try {
      const contextInfo = await buildContextInfo();
      // Try local parser first for simple commands (faster, free, works offline)
      const localResult = tryParse(text, contextInfo);
      if (localResult) {
        showPreview(localResult);
        return;
      }
      // Fall back to AI for complex requests
      const { systemPrompt, userPrompt } = await buildPrompt(contextInfo, text);
      const settings = await db.settings.get();
      const raw = await callAI(settings, systemPrompt, userPrompt);
      const parsed = parseResponse(raw);
      const validated = validateStructure(parsed);
      showPreview(validated);
    } catch (err) {
      showToast(t('aiError', { msg: err.message }));
      showInput();
    }
  }

  // --- Show input state ---
  function showInput() {
    currentState = 'input';
    abortController = null;
    modalRef?.();
    openInputModal();
  }

  function openInputModal() {
    const ref = openModal(modalHost, {
      title: t('aiSmartAdd'),
      align: 'bottom',
      content: inputContent,
      onClose: () => {
        if (recognition) stopListening();
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
      }
    });
    closeModal = ref.close;
    modalRef = () => ref.close();
    // Focus textarea
    setTimeout(() => textarea.focus(), 200);
  }

  // Start with input modal
  openInputModal();

  // Auto-start microphone if context requests it (long-press quick voice)
  if (context.startMic) {
    setTimeout(() => startListening(), 300);
  }
}

// --- Not configured modal ---
function showNotConfigured(ctx) {
  const { modalHost } = ctx;
  const content = el('div', { class: 'stack', style: { gap: '12px' } },
    el('div', { class: 'small', style: { color: 'var(--muted)' } }, t('aiNotConfiguredMsg')),
    el('button', {
      type: 'button',
      class: 'btn btn--primary',
      onClick: () => {
        location.hash = '#settings';
        return true;
      }
    }, t('aiOpenSettings'))
  );

  openModal(modalHost, {
    title: t('aiSmartAdd'),
    align: 'bottom',
    content,
    actions: [
      { label: t('cancel'), class: 'btn btn--ghost', onClick: () => true }
    ]
  });
}

// --- Create selected items in DB ---
async function createSelected(ctx, context, selected) {
  const { db } = ctx;
  const results = [];

  for (const item of selected) {
    if (item.type === 'task') {
      const todo = newTodo({
        title: item.data.title,
        projectId: context.mode === 'inbox' ? null : context.project?.id || null
      });
      // When in a checklist page, assign to the current page
      if (context.mode === 'checklist' && context.pageId) {
        todo.pageId = context.pageId;
      }
      applyTodoFields(todo, item.data);
      await db.todos.put(todo);
      results.push(todo);
    }

    else if (item.type === 'project') {
      const projData = item.data;
      const proj = newProject({
        name: projData.name,
        type: projData.type || 'default',
        parentId: context.mode === 'project' ? context.project.id : null,
        useSuggestions: projData.type === 'checklist',
        enableQtyUnits: projData.enableQtyUnits || false,
        keepCompletedItems: projData.keepCompletedItems || false
      });
      await db.projects.put(proj);
      results.push(proj);

      // Create project tasks
      if (projData.tasks && projData.tasks.length) {
        for (const taskData of projData.tasks) {
          const todo = newTodo({ title: taskData.title, projectId: proj.id });
          applyTodoFields(todo, taskData);
          await db.todos.put(todo);
          results.push(todo);
        }
      }

      // Create sub-projects recursively
      if (projData.subProjects && projData.subProjects.length) {
        for (const spData of projData.subProjects) {
          const sp = newProject({
            name: spData.name,
            type: spData.type || 'default',
            parentId: proj.id
          });
          await db.projects.put(sp);
          results.push(sp);
          // Create sub-project tasks
          if (spData.tasks && spData.tasks.length) {
            for (const taskData of spData.tasks) {
              const todo = newTodo({ title: taskData.title, projectId: proj.id });
              applyTodoFields(todo, taskData);
              await db.todos.put(todo);
              results.push(todo);
            }
          }
          // Recurse deeper sub-projects
          if (spData.subProjects && spData.subProjects.length) {
            await createSubProjectsRecursive(db, sp, spData.subProjects, results);
          }
        }
      }

      // Create checklist pages
      if (projData.type === 'checklist' && projData.pages && projData.pages.length) {
        for (let i = 0; i < projData.pages.length; i++) {
          const pageData = projData.pages[i];
          const page = newChecklistPage({ projectId: proj.id, name: pageData.name });
          page.order = i;
          await db.checklistPages.put(page);
          results.push(page);

          if (pageData.items && pageData.items.length) {
            for (let j = 0; j < pageData.items.length; j++) {
              const itemData = pageData.items[j];
              const item = newTodo({ title: itemData.title, projectId: proj.id, pageId: page.id });
              item.order = j;
              item.notes = itemData.notes || '';
              if (itemData.qty) item.itemQuantity = parseFloat(itemData.qty);
              if (itemData.unit) item.itemUnit = String(itemData.unit);
              await db.todos.put(item);
              results.push(item);
            }
          }
        }
      }
    }

    else if (item.type === 'checklistPage') {
      // Only valid in checklist context
      if (context.mode === 'checklist' && context.project) {
        const pages = await db.checklistPages.listByProject(context.project.id);
        const cpData = item.data;
        const page = newChecklistPage({ projectId: context.project.id, name: cpData.name || 'Untitled' });
        page.order = pages.length;
        await db.checklistPages.put(page);
        results.push(page);

          if (cpData.items && cpData.items.length) {
            for (let j = 0; j < cpData.items.length; j++) {
              const itemData = cpData.items[j];
              const todo = newTodo({ title: itemData.title, projectId: context.project.id, pageId: page.id });
              todo.order = j;
              todo.notes = itemData.notes || '';
              if (itemData.qty) todo.itemQuantity = parseFloat(itemData.qty);
              if (itemData.unit) todo.itemUnit = String(itemData.unit);
              await db.todos.put(todo);
              results.push(todo);
            }
          }
      }
    }

    else if (item.type === 'addToProject') {
      // Find existing project by name (case-insensitive)
      const projects = await db.projects.list();
      const match = projects.find(p => p.name.toLowerCase() === item.data.projectName.toLowerCase());
      if (match) {
        for (const taskData of item.data.tasks) {
          const todo = newTodo({ title: taskData.title, projectId: match.id });
          applyTodoFields(todo, taskData);
          await db.todos.put(todo);
          results.push(todo);
        }
      } else {
        // Project not found — create it as a new project with these tasks
        const proj = newProject({ name: item.data.projectName, type: 'default' });
        await db.projects.put(proj);
        results.push(proj);
        for (const taskData of item.data.tasks) {
          const todo = newTodo({ title: taskData.title, projectId: proj.id });
          applyTodoFields(todo, taskData);
          await db.todos.put(todo);
          results.push(todo);
        }
      }
    }

    else if (item.type === 'addToChecklistPage') {
      // Find existing project by name
      const projects = await db.projects.list();
      const matchProj = projects.find(p => p.name.toLowerCase() === item.data.projectName.toLowerCase());
      if (matchProj) {
        // Find the page by name
        const pages = await db.checklistPages.listByProject(matchProj.id);
        const matchPage = pages.find(p => (p.name || '').toLowerCase() === item.data.pageName.toLowerCase());
        const pageId = matchPage ? matchPage.id : null;
        if (!matchPage) {
          // Create the page if it doesn't exist
          const newPage = newChecklistPage({ projectId: matchProj.id, name: item.data.pageName });
          newPage.order = pages.length;
          await db.checklistPages.put(newPage);
          const items = item.data.items;
          for (let j = 0; j < items.length; j++) {
            const todo = newTodo({ title: items[j].title, projectId: matchProj.id, pageId: newPage.id });
            todo.order = j;
            todo.notes = items[j].notes || '';
            if (items[j].qty) todo.itemQuantity = parseFloat(items[j].qty);
            if (items[j].unit) todo.itemUnit = String(items[j].unit);
            await db.todos.put(todo);
            results.push(todo);
          }
        } else {
          for (const itemData of item.data.items) {
            const todo = newTodo({ title: itemData.title, projectId: matchProj.id, pageId });
            todo.notes = itemData.notes || '';
            if (itemData.qty) todo.itemQuantity = parseFloat(itemData.qty);
            if (itemData.unit) todo.itemUnit = String(itemData.unit);
            await db.todos.put(todo);
            results.push(todo);
          }
        }
      } else {
        // Project not found — fallback: create checklist project with the page
        const proj = newProject({ name: item.data.projectName, type: 'checklist' });
        await db.projects.put(proj);
        results.push(proj);
        const page = newChecklistPage({ projectId: proj.id, name: item.data.pageName });
        page.order = 0;
        await db.checklistPages.put(page);
        results.push(page);
        for (let j = 0; j < item.data.items.length; j++) {
          const itemData = item.data.items[j];
          const todo = newTodo({ title: itemData.title, projectId: proj.id, pageId: page.id });
          todo.order = j;
          todo.notes = itemData.notes || '';
          if (itemData.qty) todo.itemQuantity = parseFloat(itemData.qty);
          if (itemData.unit) todo.itemUnit = String(itemData.unit);
          await db.todos.put(todo);
          results.push(todo);
        }
      }
    }

    else if (item.type === 'moveTask') {
      const { taskTitle, targetProject, targetPage } = item.data;
      // Find the task by title (case-insensitive, first exact match, then partial)
      const allTodos = await db.todos.listActive();
      const matchTask = allTodos.find(t => t.title.toLowerCase() === taskTitle.toLowerCase())
        || allTodos.find(t => t.title.toLowerCase().includes(taskTitle.toLowerCase()));
      if (matchTask) {
        // Find the target project
        const projects = await db.projects.list();
        const matchProj = projects.find(p => p.name.toLowerCase() === targetProject.toLowerCase());
        if (matchProj) {
          matchTask.projectId = matchProj.id;
          // If target page specified, find it
          if (targetPage) {
            const pages = await db.checklistPages.listByProject(matchProj.id);
            const matchPage = pages.find(p => (p.name || '').toLowerCase() === targetPage.toLowerCase());
            if (matchPage) matchTask.pageId = matchPage.id;
          }
          await db.todos.put(matchTask);
          results.push(matchTask);
        }
      }
    }

    else if (item.type === 'note') {
      if (context.mode === 'project' || context.mode === 'checklist') {
        if (context.project) {
          const note = newProjectNote({ projectId: context.project.id, text: item.data.text });
          await db.projectNotes.put(note);
          results.push(note);
        }
      }
    }
  }

  return results;
}

function applyTodoFields(todo, data) {
  todo.notes = data.notes || '';
  todo.dueDate = data.dueDate || null;
  if (data.priority) todo.priority = data.priority;
  if (data.protected === true) todo.protected = true;
  if (data.showInInbox === true) todo.showInInbox = true;
  if (data.recurrenceType) {
    todo.recurrenceType = data.recurrenceType;
    if (data.recurrenceType === 'weekly' && data.recurrenceDays) {
      todo.recurrenceDetails = { days: data.recurrenceDays };
    }
  }
}

async function createSubProjectsRecursive(db, parentProject, subProjects, results) {
  for (const spData of subProjects) {
    const sp = newProject({
      name: spData.name,
      type: spData.type || 'default',
      parentId: parentProject.id
    });
    await db.projects.put(sp);
    results.push(sp);

    if (spData.tasks && spData.tasks.length) {
      for (const taskData of spData.tasks) {
        const todo = newTodo({ title: taskData.title, projectId: parentProject.id });
        applyTodoFields(todo, taskData);
        await db.todos.put(todo);
        results.push(todo);
      }
    }

    if (spData.subProjects && spData.subProjects.length) {
      await createSubProjectsRecursive(db, sp, spData.subProjects, results);
    }
  }
}
