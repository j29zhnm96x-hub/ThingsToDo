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
 * Returns { todos, projects, voiceMemos }
 */
export async function searchAll(db, query) {
  const q = query.trim().toLowerCase();
  if (!q) return { todos: [], projects: [], voiceMemos: [] };

  const [allProjects, allTodos, allMemos] = await Promise.all([
    db.projects.list(),
    db.todos.list(),
    db.voiceMemos.list()
  ]);

  const projectNames = new Map(allProjects.map(p => [p.id, p.name]));

  // Search active non-archived todos (title + notes)
  const todos = [];
  for (const t of allTodos) {
    if (t.archived) continue;
    const title = (t.title || '').toLowerCase();
    const notes = (t.notes || '').toLowerCase();
    if (title.includes(q) || notes.includes(q)) {
      todos.push({ ...t, _projectName: projectNames.get(t.projectId) || null });
    }
  }

  // Search projects (name)
  const projects = allProjects.filter(p =>
    (p.name || '').toLowerCase().includes(q)
  );

  // Search voice memos (title)
  const voiceMemos = allMemos.filter(m =>
    (m.title || '').toLowerCase().includes(q)
  );

  return { todos, projects, voiceMemos };
}
