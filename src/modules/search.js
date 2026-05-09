// Search module — queries IndexedDB for matching entities

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Search across todos, projects, and voice memos.
 * @param {string} scope - 'all' (default) or 'archive'
 * Returns { todos, projects, voiceMemos }
 */
export async function searchAll(db, query, scope = 'all') {
  const q = query.trim().toLowerCase();
  if (!q) return { todos: [], projects: [], voiceMemos: [] };

  const scopeIsArchive = scope === 'archive';

  // For archive search: only search archived todos
  // For normal search: search active todos + projects + voice memos
  const [allProjects, allTodos, allMemos] = await Promise.all([
    scopeIsArchive ? [] : db.projects.list(),
    scopeIsArchive ? db.todos.listArchived() : db.todos.listActive(),
    scopeIsArchive ? [] : db.voiceMemos.list()
  ]);

  const projectNames = new Map(allProjects.map(p => [p.id, p.name]));

  // Search todos (title + notes)
  const todos = [];
  for (const t of allTodos) {
    const title = (t.title || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    if (title.includes(q) || notes.includes(q)) {
      todos.push({ ...t, _projectName: projectNames.get(t.projectId) || null });
    }
  }

  // Search projects (name) — not in archive scope
  const projects = scopeIsArchive ? [] : allProjects.filter(p =>
    (p.name || '').toLowerCase().includes(q)
  );

  // Search voice memos (title) — not in archive scope
  const voiceMemos = scopeIsArchive ? [] : allMemos.filter(m =>
    (m.title || '').toLowerCase().includes(q)
  );

  return { todos, projects, voiceMemos };
}
