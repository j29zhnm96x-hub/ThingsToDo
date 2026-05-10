// Statistics data module — queries IndexedDB for productivity metrics

const DAY_MS = 86400000;

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dateFromKey(key) {
  return new Date(key + 'T00:00:00');
}

function todayKey() {
  return dayKey(new Date());
}

/** How many days between two ISO dates */
function daysBetween(isoA, isoB) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

/**
 * Count how many tasks were completed on each of the last N days.
 * Returns Map<dayKey, count>
 */
async function completedPerDay(db, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);

  const all = await db.todos.list();
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
  const all = await db.todos.list();
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
  const today = todayKey();

  // Build last N days as boolean array
  const dayArr = [];
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const count = perDay.get(key) || 0;
    const didWork = count > 0;
    dayArr.push(didWork);

    if (didWork) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      // Current streak only counts if today or consecutive from today
      if (i === 0) currentStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  // Recalculate current streak properly: count backwards from today
  currentStreak = 0;
  for (let i = dayArr.length - 1; i >= 0; i--) {
    if (dayArr[i]) currentStreak++;
    else break;
  }

  return { current: currentStreak, longest: longestStreak, days: dayArr };
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
    const count = perDay.get(key) || 0;
    const dayName = labels[d.getDay()];
    result.push({ day: dayName, count, key });
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
    const count = perDay.get(key) || 0;
    result.push({ date: key, count, day: d.getDate(), weekday: d.getDay() });
  }
  return result;
}

/** Overall completion rate */
export async function getCompletionRate(db) {
  const all = await db.todos.list();
  let completed = 0;
  let active = 0;
  let archived = 0;

  for (const t of all) {
    if (t.completed && !t.archived) completed++;
    else if (t.archived) archived++;
    else active++;
  }

  const total = all.length || 1; // avoid division by zero
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
  const all = await db.todos.list();
  const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun=0..Sat=6
  const labels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const t of all) {
    if (!t.completed || !t.completedAt) continue;
    const d = new Date(t.completedAt);
    dayCounts[d.getDay()]++;
  }

  let max = 0;
  let maxIdx = 0;
  for (let i = 0; i < 7; i++) {
    if (dayCounts[i] > max) {
      max = dayCounts[i];
      maxIdx = i;
    }
  }

  return { day: labels[maxIdx], count: max };
}
