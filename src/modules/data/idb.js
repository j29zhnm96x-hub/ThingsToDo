// Lightweight IndexedDB helpers.
// Important decisions:
// - Keep wrapper tiny (less magic, easier to debug on mobile Safari).
// - Use per-store helpers for get/put/delete/list.

export function openDb({ name, version, upgrade }) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = () => {
      upgrade(req.result, req.transaction);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function reqDone(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function storeApi(db, storeName) {
  return {
    async get(key) {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const res = await reqDone(store.get(key));
      await txDone(tx);
      return res;
    },
    async put(value) {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      await reqDone(store.put(value));
      await txDone(tx);
    },
    async delete(key) {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      await reqDone(store.delete(key));
      await txDone(tx);
    },
    async clear() {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      await reqDone(store.clear());
      await txDone(tx);
    },
    async list() {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const res = await reqDone(store.getAll());
      await txDone(tx);
      return res;
    }
  };
}
