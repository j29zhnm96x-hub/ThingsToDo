// Core data models. Keep these as plain objects for easy export/import.

export const Priority = {
  URGENT: 'URGENT',
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3'
};

function uuid() {
  // iOS should support crypto.randomUUID in modern versions, but keep a fallback.
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const rnd = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function newProject({ name, type = 'default', parentId = null }) {
  const t = nowIso();
  return {
    id: uuid(),
    name: name.trim(),
    type,
    parentId, // Parent project ID if it is a sub-project
    createdAt: t,
    updatedAt: t,
    sortOrder: t // default: by created time
  };
}

export function newTodo({ title, projectId }) {
  const t = nowIso();
  return {
    id: uuid(),
    title: title.trim(),
    notes: '',
    priority: Priority.P2,
    dueDate: null,
    completed: false,
    completedAt: null,
    projectId: projectId ?? null,
    archived: false,
    archivedAt: null,
    archivedFromProjectId: null,
    showInInbox: false,
    order: 0,
    createdAt: t,
    updatedAt: t
  };
}

export function newAttachment({ todoId, blob, name, type }) {
  return {
    id: uuid(),
    todoId,
    name: name || 'image',
    type: type || blob.type || 'application/octet-stream',
    blob,
    createdAt: nowIso()
  };
}
