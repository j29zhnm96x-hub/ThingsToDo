import { generateId, nowIso } from '../data/models.js';

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

function sanitizeName(name) {
  if (!name) return 'item';
  return String(name).trim().replace(/[^a-z0-9-_\.]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'item';
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function exportToFile(payload, suggestedName) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportTodoToFile(db, todo) {
  const attachments = await db.attachments.listForTodo(todo.id);
  const outAtts = [];
  for (const a of (attachments || [])) {
    try {
      const d = a.blob ? await blobToDataUrl(a.blob) : null;
      const thumb = a.thumb ? await blobToDataUrl(a.thumb) : null;
      outAtts.push({ id: a.id, todoId: a.todoId, name: a.name, type: a.type, createdAt: a.createdAt, dataUrl: d, thumbDataUrl: thumb });
    } catch (e) {
      // best-effort; skip attachment on failure to encode
      console.error('Failed to encode attachment for export', e);
    }
  }

  const payload = {
    version: 1,
    exportedAt: nowIso(),
    type: 'todo',
    todo,
    attachments: outAtts
  };

  const base = sanitizeName(todo.title || todo.id || 'todo');
  const fileName = `thingstodo-todo-${base}-${dateStamp()}.json`;
  await exportToFile(payload, fileName);
}

export async function exportProjectToFile(db, project) {
  const todos = await db.todos.listByProject(project.id);
  const checklistPages = await db.checklistPages.listByProject(project.id);
  let projectNotes = [];
  try { projectNotes = await db.projectNotes.listByProject(project.id); } catch (e) { /* best-effort */ }

  const outAtts = [];
  for (const t of (todos || [])) {
    const atts = await db.attachments.listForTodo(t.id);
    for (const a of (atts || [])) {
      try {
        const d = a.blob ? await blobToDataUrl(a.blob) : null;
        const thumb = a.thumb ? await blobToDataUrl(a.thumb) : null;
        outAtts.push({ id: a.id, todoId: a.todoId, name: a.name, type: a.type, createdAt: a.createdAt, dataUrl: d, thumbDataUrl: thumb });
      } catch (e) {
        console.error('Failed to encode attachment for export', e);
      }
    }
  }

  const payload = {
    version: 1,
    exportedAt: nowIso(),
    type: 'project',
    project,
    todos,
    checklistPages,
    projectNotes,
    attachments: outAtts
  };

  const base = sanitizeName(project.name || project.id || 'project');
  const fileName = `thingstodo-project-${base}-${dateStamp()}.json`;
  await exportToFile(payload, fileName);
}

// Import a parsed payload object. Returns { type }
export async function importSharedObject(parsed, db) {
  if (!parsed || !parsed.type) throw new Error('Invalid shared payload');

  if (parsed.type === 'todo') {
    const src = parsed.todo;
    if (!src) throw new Error('Missing todo in payload');
    const newId = generateId();
    const now = nowIso();
    const todo = { ...src, id: newId, projectId: null, showInInbox: true, createdAt: now, updatedAt: now };
    await db.todos.put(todo);

    for (const a of (parsed.attachments || [])) {
      if (!a.dataUrl) continue;
      try {
        const blob = await dataUrlToBlob(a.dataUrl);
        const thumb = a.thumbDataUrl ? await dataUrlToBlob(a.thumbDataUrl) : null;
        const att = { id: generateId(), todoId: newId, name: a.name, type: a.type, createdAt: a.createdAt || now, blob, thumb };
        await db.attachments.put(att);
      } catch (e) {
        console.error('Failed to restore attachment on import', e);
      }
    }

    return { type: 'todo' };
  }

  if (parsed.type === 'project') {
    const src = parsed.project;
    if (!src) throw new Error('Missing project in payload');
    const now = nowIso();
    const newProjectId = generateId();
    const project = { ...src, id: newProjectId, parentId: src.parentId || null, createdAt: now, updatedAt: now };
    await db.projects.put(project);

    // Map old todo ids -> new ids
    const idMap = new Map();
    for (const t of (parsed.todos || [])) {
      const newId = generateId();
      idMap.set(t.id, newId);
      const nt = { ...t, id: newId, projectId: newProjectId, createdAt: now, updatedAt: now };
      await db.todos.put(nt);
    }

    for (const page of (parsed.checklistPages || [])) {
      try {
        const np = { ...page, id: generateId(), projectId: newProjectId, createdAt: page.createdAt || now, updatedAt: page.updatedAt || now };
        await db.checklistPages.put(np);
      } catch (e) { console.error('Failed to import checklist page', e); }
    }

    for (const note of (parsed.projectNotes || [])) {
      try {
        const nn = { ...note, id: generateId(), projectId: newProjectId, createdAt: note.createdAt || now, updatedAt: note.updatedAt || now };
        await db.projectNotes.put(nn);
      } catch (e) { console.error('Failed to import project note', e); }
    }

    for (const a of (parsed.attachments || [])) {
      if (!a.dataUrl || !a.todoId) continue;
      try {
        const blob = await dataUrlToBlob(a.dataUrl);
        const thumb = a.thumbDataUrl ? await dataUrlToBlob(a.thumbDataUrl) : null;
        const newTodoId = idMap.get(a.todoId) || null;
        const att = { id: generateId(), todoId: newTodoId, name: a.name, type: a.type, createdAt: a.createdAt || now, blob, thumb };
        await db.attachments.put(att);
      } catch (e) {
        console.error('Failed to import attachment', e);
      }
    }

    return { type: 'project' };
  }

  throw new Error('Unsupported shared payload type');
}

// Accept either a JSON string or an already-parsed object
export async function importShared(input, db) {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  return importSharedObject(parsed, db);
}
