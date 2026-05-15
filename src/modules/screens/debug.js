import { el, clear } from '../ui/dom.js';

export async function renderDebug(ctx) {
  const { main, db } = ctx;
  clear(main);

  const pre = el('pre', {
    style: 'white-space:pre-wrap;font-size:12px;padding:16px;overflow:auto;max-height:80vh'
  }, 'Loading...');
  main.append(pre);

  try {
    const [active, archived, projects, settings, memos] = await Promise.all([
      db.todos.listActive(),
      db.todos.listArchived(),
      db.projects.list(),
      db.settings.get(),
      db.voiceMemos.list().catch(() => [])
    ]);

    pre.textContent = [
      `Active todos: ${active.length}`,
      ...active.map(t => `  "${t.title}" projectId=${JSON.stringify(t.projectId)} archived=${t.archived} showInInbox=${t.showInInbox} dueDate=${t.dueDate} inboxBefore=${t.inboxBefore}`),
      '',
      `Archived todos: ${archived.length}`,
      ...archived.map(t => `  "${t.title}" projectId=${JSON.stringify(t.projectId)}`),
      '',
      `Projects: ${projects.length}`,
      ...projects.map(p => `  "${p.name}" id=${p.id} showInInbox=${p.showInInbox}`),
      '',
      `Settings keys: ${Object.keys(settings).join(', ')}`,
      `Language: ${localStorage.getItem('app-language') || 'en'}`,
      '',
      `Voice memos: ${memos.length}`,
      '',
      '--- All IndexedDB records ---'
    ].join('\n');

    // Also dump raw records
    const dbi = await new Promise((resolve, reject) => {
      const req = indexedDB.open('thingstodo-db', 10);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const tx = dbi.transaction('todos', 'readonly');
    const store = tx.objectStore('todos');
    const all = await new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    dbi.close();

    pre.textContent += '\n' + all.map(t =>
      `[${t.id.slice(0,8)}] "${t.title}" pid=${JSON.stringify(t.projectId)} arch=${t.archived} comp=${t.completed}`
    ).join('\n');

    if (all.length > 0) {
      pre.textContent += '\n\n--- First raw record ---\n' + JSON.stringify(all[0], null, 2);
    }
  } catch (err) {
    pre.textContent = 'ERROR: ' + err.message + '\n' + err.stack;
  }
}
