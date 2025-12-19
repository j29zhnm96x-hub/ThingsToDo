import { openDb, storeApi, txDone, reqDone } from './idb.js';
import { nowIso } from './models.js';

const DB_NAME = 'thingstodo-db';
const DB_VERSION = 1;

function upgrade(db) {
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
      return storeApi(dbi, 'todos').get(id);
    },
    async put(todo) {
      const dbi = await getDb();
      todo.updatedAt = nowIso();
      return storeApi(dbi, 'todos').put(todo);
    },
    async delete(id) {
      const dbi = await getDb();
      await storeApi(dbi, 'todos').delete(id);
      await deleteAttachmentsForTodo(id);
    },
    async listActive() {
      const all = await listByIndex('todos', 'by_archived', false);
      return all;
    },
    async listArchived() {
      const all = await listByIndex('todos', 'by_archived', true);
      return all;
    },
    async listByProject(projectIdOrNull) {
      const all = await listByIndex('todos', 'by_project', projectIdOrNull);
      // Caller typically filters archived.
      return all;
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

  async wipeAll() {
    const dbi = await getDb();
    await Promise.all([
      storeApi(dbi, 'todos').clear(),
      storeApi(dbi, 'projects').clear(),
      storeApi(dbi, 'attachments').clear(),
      storeApi(dbi, 'settings').clear()
    ]);
  }
};
