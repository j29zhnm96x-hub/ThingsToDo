const PRIORITY_RANK = { URGENT: -1, P0: 0, P1: 1, P2: 2, P3: 3 };

export function compareTodos(a, b) {
  const pa = PRIORITY_RANK[a.priority] ?? 99;
  const pb = PRIORITY_RANK[b.priority] ?? 99;
  if (pa !== pb) return pa - pb;

  // Manual order within same priority
  const oa = Number.isFinite(a.order) ? a.order : 0;
  const ob = Number.isFinite(b.order) ? b.order : 0;
  if (oa !== ob) return oa - ob;

  // CreatedAt fallback
  return String(a.createdAt).localeCompare(String(b.createdAt));
}

export function maxOrderFor(todos, { priority }) {
  let max = -1;
  for (const t of todos) {
    if (t.priority === priority) {
      const v = Number.isFinite(t.order) ? t.order : 0;
      if (v > max) max = v;
    }
  }
  return max;
}
