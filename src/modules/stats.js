// Statistics data module — queries IndexedDB for productivity metrics

const DAY_MS = 86400000;

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayKey() {
  return dayKey(new Date());
}

/** Get all todos (active + archived) — db.todos has no list() method */
async function getAllTodos(db) {
  const [active, archived] = await Promise.all([
    db.todos.listActive(),
    db.todos.listArchived()
  ]);
  return [...active, ...archived];
}

/** Count completed tasks per day for the last N days */
async function completedPerDay(db, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const all = await getAllTodos(db);
  const map = new Map();
  for (const t of all) {
    if (!t.completed || !t.completedAt) continue;
    const d = new Date(t.completedAt);
    if (d < cutoff) continue;
    const key = dayKey(d);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

/** Today's summary */
export async function getTodayStats(db) {
  const today = todayKey();
  const all = await getAllTodos(db);
  let completed = 0;
  let dueToday = 0;
  let overdue = 0;

  for (const t of all) {
    if (t.archived) continue;
    if (t.completed && t.completedAt && dayKey(new Date(t.completedAt)) === today) {
      completed++;
    }
    if (t.dueDate) {
      const dk = dayKey(new Date(t.dueDate));
      if (dk === today) dueToday++;
      if (dk < today && !t.completed) overdue++;
    }
  }
  return { completed, dueToday, overdue };
}

/** Streak data */
export async function getStreakData(db, days = 30) {
  const perDay = await completedPerDay(db, days);
  const dayArr = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const count = perDay.get(key) || 0;
    dayArr.push(count > 0);
  }

  // Current streak: count backwards from today
  let current = 0;
  for (let i = dayArr.length - 1; i >= 0; i--) {
    if (dayArr[i]) current++;
    else break;
  }

  // Longest streak in this period
  let longest = 0;
  let temp = 0;
  for (const active of dayArr) {
    if (active) { temp++; if (temp > longest) longest = temp; }
    else temp = 0;
  }

  return { current, longest, days: dayArr };
}

/** Weekly bar chart data: last 7 days */
export async function getWeeklyData(db) {
  const perDay = await completedPerDay(db, 7);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    result.push({ day: labels[d.getDay()], count: perDay.get(key) || 0, key });
  }
  return result;
}

/** Monthly heatmap data: last 30 days */
export async function getMonthlyData(db) {
  const perDay = await completedPerDay(db, 30);
  const result = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    result.push({ date: key, count: perDay.get(key) || 0, day: d.getDate(), weekday: d.getDay() });
  }
  return result;
}

/** Overall completion rate */
export async function getCompletionRate(db) {
  const all = await getAllTodos(db);
  let completed = 0;
  let active = 0;
  let archived = 0;

  for (const t of all) {
    if (t.completed && !t.archived) completed++;
    else if (t.archived) archived++;
    else active++;
  }

  const total = all.length || 1;
  return {
    completed,
    active,
    archived,
    total: all.length,
    percent: Math.round((completed / total) * 100)
  };
}

/** Most productive day of the week */
export async function getProductiveDay(db) {
  const all = await getAllTodos(db);
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const t of all) {
    if (!t.completed || !t.completedAt) continue;
    const d = new Date(t.completedAt);
    dayCounts[d.getDay()]++;
  }

  let max = 0;
  let maxIdx = 0;
  for (let i = 0; i < 7; i++) {
    if (dayCounts[i] > max) { max = dayCounts[i]; maxIdx = i; }
  }

  return { day: labels[maxIdx], count: max };
}
