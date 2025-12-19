// Core data models. Keep these as plain objects for easy export/import.

export const Priority = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3'
};

export function nowIso() {
  return new Date().toISOString();
}

export function newProject({ name }) {
  const t = nowIso();
  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: t,
    updatedAt: t,
    sortOrder: t // default: by created time
  };
}

export function newTodo({ title, projectId }) {
  const t = nowIso();
  return {
    id: crypto.randomUUID(),
    title: title.trim(),
    notes: '',
    priority: Priority.P2,
    dueDate: null,
    completed: false,
    projectId: projectId ?? null,
    archived: false,
    archivedAt: null,
    archivedFromProjectId: null,
    order: 0,
    createdAt: t,
    updatedAt: t
  };
}

export function newAttachment({ todoId, blob, name, type }) {
  return {
    id: crypto.randomUUID(),
    todoId,
    name: name || 'image',
    type: type || blob.type || 'application/octet-stream',
    blob,
    createdAt: nowIso()
  };
}
