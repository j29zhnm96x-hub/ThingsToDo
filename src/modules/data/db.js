import { openDb, storeApi, txDone, reqDone } from './idb.js';
import { nowIso } from './models.js';

const DB_NAME = 'thingstodo-db';
const DB_VERSION = 10;

// IndexedDB indexes cannot use `null` keys reliably across browsers.
// We store Inbox as a stable string sentinel and normalize at the API boundary.
const INBOX_PROJECT_ID = '__inbox__';

function normalizeTodoIn(todo) {
  if (!todo) return todo;
  const t = { ...todo };
  if (t.projectId == null) t.projectId = INBOX_PROJECT_ID;
  return t;
}

function normalizeTodoOut(todo) {
  if (!todo) return todo;
  const t = { ...todo };
  if (t.projectId === INBOX_PROJECT_ID) t.projectId = null;
  return t;
}

function upgrade(db, tx) {
  const upgradeFrom = tx?.oldVersion ?? 0;
  // todos: by id
  if (!db.objectStoreNames.contains('todos')) {
    const s = db.createObjectStore('todos', { keyPath: 'id' });
    s.createIndex('by_archived', 'archived', { unique: false });
    s.createIndex('by_project', 'projectId', { unique: false });
  }

  // projects: by id
  if (!db.objectStoreNames.contains('projects')) {
    db.createObjectStore('projects', { keyPath: 'id' });
  }

  // attachments: by id, indexed by todoId
  if (!db.objectStoreNames.contains('attachments')) {
    const s = db.createObjectStore('attachments', { keyPath: 'id' });
    s.createIndex('by_todo', 'todoId', { unique: false });
  }

  // single settings record
  if (!db.objectStoreNames.contains('settings')) {
    db.createObjectStore('settings', { keyPath: 'id' });
  }

  // bin: by id (for soft deleted items)
  if (!db.objectStoreNames.contains('bin')) {
    db.createObjectStore('bin', { keyPath: 'id' });
  }

  // voiceMemos: by id, indexed by projectId
  if (!db.objectStoreNames.contains('voiceMemos')) {
    const s = db.createObjectStore('voiceMemos', { keyPath: 'id' });
    s.createIndex('by_project', 'projectId', { unique: false });
  }

  // checklistPages: by id, indexed by projectId
  if (!db.objectStoreNames.contains('checklistPages')) {
    const s = db.createObjectStore('checklistPages', { keyPath: 'id' });
    s.createIndex('by_project', 'projectId', { unique: false });
  }

  // checklistSuggestions: autocomplete memory for checklist items
  if (!db.objectStoreNames.contains('checklistSuggestions')) {
    const s = db.createObjectStore('checklistSuggestions', { keyPath: 'id', autoIncrement: true });
    s.createIndex('by_textLower', 'textLower', { unique: true });
  }

  // projectNotes: freeform notes per project
  if (!db.objectStoreNames.contains('projectNotes')) {
    const s = db.createObjectStore('projectNotes', { keyPath: 'id' });
    s.createIndex('by_project', 'projectId', { unique: false });
  }

  // Migration (v1 -> v2): replace null projectId with sentinel so it indexes.
  // This fixes Safari/WebKit issues where null values are not indexed and
  // transitions null -> string may not re-index reliably.
  try {
    if (tx && tx.objectStoreNames.contains('todos')) {
      const store = tx.objectStore('todos');
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        const v = cursor.value;
        if (v && v.projectId == null) {
          v.projectId = INBOX_PROJECT_ID;
          cursor.update(v);
        }
        cursor.continue();
      };
    }
  } catch {
    // Best-effort migration; app will still function via fallbacks.
  }

  if (upgradeFrom < 8 && tx && tx.objectStoreNames.contains('checklistPages')) {
    const store = tx.objectStore('checklistPages');
    const pages = [];
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        if (pages.length === 0) return;
        const missing = pages.filter(page => !Number.isFinite(page.order));
        if (missing.length === 0) return;
        const sorted = [...pages].sort((a, b) => {
          const aDate = Date.parse(a.createdAt || '') || 0;
          const bDate = Date.parse(b.createdAt || '') || 0;
          if (aDate !== bDate) return aDate - bDate;
          return (a.id || '').localeCompare(b.id || '');
        });
        let maxOrder = sorted.reduce((acc, page) => (Number.isFinite(page.order) ? Math.max(acc, page.order) : acc), -1);
        for (const page of sorted) {
          if (Number.isFinite(page.order)) continue;
          page.order = ++maxOrder;
          store.put(page);
        }
        return;
      }
      pages.push(cursor.value);
      cursor.continue();
    };
  }
}

let _dbPromise = null;

async function getDb() {
  if (!_dbPromise) {
    _dbPromise = openDb({ name: DB_NAME, version: DB_VERSION, upgrade });
  }
  return _dbPromise;
}

async function listByIndex(storeName, indexName, key) {
  const db = await getDb();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const idx = store.index(indexName);
  const res = await reqDone(idx.getAll(key));
  await txDone(tx);
  return res;
}

async function deleteAttachmentsForTodo(todoId) {
  const db = await getDb();
  const tx = db.transaction('attachments', 'readwrite');
  const store = tx.objectStore('attachments');
  const idx = store.index('by_todo');
  const keysReq = idx.getAllKeys(todoId);
  const keys = await reqDone(keysReq);
  for (const key of keys) store.delete(key);
  await txDone(tx);
}

export const db = {
  async ready() {
    await getDb();
  },

  todos: {
    async get(id) {
      const dbi = await getDb();
      const t = await storeApi(dbi, 'todos').get(id);
      return normalizeTodoOut(t);
    },
    async put(todo) {
      const dbi = await getDb();
      todo.updatedAt = nowIso();
      return storeApi(dbi, 'todos').put(normalizeTodoIn(todo));
    },
    async delete(id) {
      const dbi = await getDb();
      await storeApi(dbi, 'todos').delete(id);
      await deleteAttachmentsForTodo(id);
    },
    async listActive() {
      // Safari/WebKit has a bug where updating an indexed field doesn't always
      // update the index. Always do a full scan for reliability.
      const dbi = await getDb();
      const items = await storeApi(dbi, 'todos').list();
      return items.filter((t) => !t.archived).map(normalizeTodoOut);
    },
    async listArchived() {
      // Safari/WebKit has a bug where updating an indexed field doesn't always
      // update the index. Always do a full scan for reliability.
      const dbi = await getDb();
      const items = await storeApi(dbi, 'todos').list();
      return items.filter((t) => t.archived).map(normalizeTodoOut);
    },
    async listByProject(projectIdOrNull) {
      const key = projectIdOrNull == null ? INBOX_PROJECT_ID : projectIdOrNull;

      // Safari/WebKit has a bug where updating an indexed field doesn't always
      // update the index. Always do a full scan for reliability.
      const dbi = await getDb();
      const items = await storeApi(dbi, 'todos').list();
      return items.filter((t) => t.projectId === key).map(normalizeTodoOut);
    }
  },

  projects: {
    async get(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'projects').get(id);
    },
    async put(project) {
      const dbi = await getDb();
      project.updatedAt = nowIso();
      return storeApi(dbi, 'projects').put(project);
    },
    async delete(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'projects').delete(id);
    },
    async list() {
      const dbi = await getDb();
      const items = await storeApi(dbi, 'projects').list();
      // Stable ordering
      return items.sort((a, b) => String(a.sortOrder).localeCompare(String(b.sortOrder)));
    }
  },

  attachments: {
    async listForTodo(todoId) {
      return listByIndex('attachments', 'by_todo', todoId);
    },
    async put(att) {
      const dbi = await getDb();
      return storeApi(dbi, 'attachments').put(att);
    },
    async delete(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'attachments').delete(id);
    },
    async clear() {
      const dbi = await getDb();
      return storeApi(dbi, 'attachments').clear();
    },
    async list() {
      const dbi = await getDb();
      return storeApi(dbi, 'attachments').list();
    }
  },

  checklistSuggestions: {
    async remember(texts = []) {
      const clean = (texts || [])
        .map((t) => (t || '').trim())
        .filter(Boolean)
        .map((t) => ({ text: t, textLower: t.toLowerCase(), createdAt: nowIso() }));
      if (!clean.length) return;

      const dbi = await getDb();
      const tx = dbi.transaction('checklistSuggestions', 'readwrite');
      const store = tx.objectStore('checklistSuggestions');
      const idx = store.index('by_textLower');

      for (const item of clean) {
        try {
          const existing = await reqDone(idx.get(item.textLower));
          if (existing) continue;
          store.add(item);
        } catch {
          // best-effort; ignore failures
        }
      }

      await txDone(tx);
    },

    async search(prefix = '', limit = 5) {
      const query = (prefix || '').trim().toLowerCase();
      if (!query) return [];

      const dbi = await getDb();
      const all = await storeApi(dbi, 'checklistSuggestions').list();
      return all
        .filter((item) => item?.textLower?.startsWith(query))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, limit)
        .map((item) => item.text);
    },

    async list() {
      const dbi = await getDb();
      return storeApi(dbi, 'checklistSuggestions').list();
    },

    async delete(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'checklistSuggestions').delete(id);
    },

    async clear() {
      const dbi = await getDb();
      return storeApi(dbi, 'checklistSuggestions').clear();
    }
  },

  settings: {
    async get() {
      const dbi = await getDb();
      const api = storeApi(dbi, 'settings');
      const existing = await api.get('settings');
      return existing || { id: 'settings', createdAt: nowIso(), updatedAt: nowIso() };
    },
    async put(settings) {
      const dbi = await getDb();
      settings.updatedAt = nowIso();
      return storeApi(dbi, 'settings').put(settings);
    }
  },

  bin: {
    async put(item) {
      const dbi = await getDb();
      return storeApi(dbi, 'bin').put(item);
    },
    async get(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'bin').get(id);
    },
    async delete(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'bin').delete(id);
    },
    async list() {
      const dbi = await getDb();
      return storeApi(dbi, 'bin').list();
    }
  },

  voiceMemos: {
    async get(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'voiceMemos').get(id);
    },
    async put(memo) {
      const dbi = await getDb();
      memo.updatedAt = nowIso();
      return storeApi(dbi, 'voiceMemos').put(memo);
    },
    async delete(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'voiceMemos').delete(id);
    },
    async list() {
      const dbi = await getDb();
      const items = await storeApi(dbi, 'voiceMemos').list();
      return items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    async listByProject(projectIdOrNull) {
      const dbi = await getDb();
      const items = await storeApi(dbi, 'voiceMemos').list();
      if (projectIdOrNull === null) {
        return items.filter(m => m.projectId === null).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      }
      return items.filter(m => m.projectId === projectIdOrNull).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    async listForInbox() {
      const dbi = await getDb();
      const items = await storeApi(dbi, 'voiceMemos').list();
      return items.filter(m => m.projectId === null || m.showInInbox).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }
  },

  checklistPages: {
    async get(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'checklistPages').get(id);
    },
    async put(page) {
      const dbi = await getDb();
      page.updatedAt = nowIso();
      return storeApi(dbi, 'checklistPages').put(page);
    },
    async delete(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'checklistPages').delete(id);
    },
    async list() {
      const dbi = await getDb();
      return storeApi(dbi, 'checklistPages').list();
    },
    async listByProject(projectId) {
      const items = await listByIndex('checklistPages', 'by_project', projectId);
      return items.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  },

  projectNotes: {
    async get(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'projectNotes').get(id);
    },
    async put(note) {
      const dbi = await getDb();
      note.updatedAt = nowIso();
      return storeApi(dbi, 'projectNotes').put(note);
    },
    async delete(id) {
      const dbi = await getDb();
      return storeApi(dbi, 'projectNotes').delete(id);
    },
    async listByProject(projectId) {
      return listByIndex('projectNotes', 'by_project', projectId);
    },
    async list() {
      const dbi = await getDb();
      return storeApi(dbi, 'projectNotes').list();
    },
    async clearForProject(projectId) {
      const dbi = await getDb();
      const tx = dbi.transaction('projectNotes', 'readwrite');
      const store = tx.objectStore('projectNotes');
      const idx = store.index('by_project');
      const keysReq = idx.getAllKeys(projectId);
      const keys = await reqDone(keysReq);
      for (const key of keys) store.delete(key);
      await txDone(tx);
    }
  },

  async wipeAll() {
    const dbi = await getDb();
    await Promise.all([
      storeApi(dbi, 'todos').clear(),
      storeApi(dbi, 'projects').clear(),
      storeApi(dbi, 'attachments').clear(),
      storeApi(dbi, 'settings').clear(),
      storeApi(dbi, 'bin').clear(),
      storeApi(dbi, 'voiceMemos').clear(),
      storeApi(dbi, 'checklistPages').clear(),
      storeApi(dbi, 'projectNotes').clear()
    ]);
  }
};
