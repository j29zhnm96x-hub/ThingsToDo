// Calendar view — monthly grid showing tasks on their due dates
import { el } from './dom.js';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/**
 * Build a month grid with task counts per day.
 * @param {number} year
 * @param {number} month (0-indexed)
 * @param {Map<string, number>} taskCountByDay — dayKey -> count
 * @param {number} selectedDay — day number (1-31), or 0 for none
 * @param {function} onSelectDay — (day) => void
 */
export function renderCalendarGrid(year, month, taskCountByDay, selectedDay, onSelectDay) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const header = el('div', { class: 'cal-header' },
    el('button', { class: 'cal-nav', type: 'button', onClick: () => onSelectDay('prev') }, '‹'),
    el('span', { class: 'cal-title' }, `${MONTHS[month]} ${year}`),
    el('button', { class: 'cal-nav', type: 'button', onClick: () => onSelectDay('next') }, '›')
  );

  // Weekday labels
  const weekRow = el('div', { class: 'cal-week' });
  for (const d of WEEKDAYS) {
    weekRow.appendChild(el('span', { class: 'cal-weekday' }, d));
  }

  // Day cells
  const grid = el('div', { class: 'cal-grid' });
  
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(el('div', { class: 'cal-cell cal-cell--empty' }));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const count = taskCountByDay.get(dateStr) || 0;
    const isToday = dateStr === todayStr;
    const isSelected = day === selectedDay;
    const classes = `cal-cell${isToday ? ' cal-cell--today' : ''}${isSelected ? ' cal-cell--selected' : ''}${count > 0 ? ' cal-cell--has' : ''}`;

    const cell = el('div', {
      class: classes,
      onClick: () => onSelectDay(day === selectedDay ? 0 : day)
    },
      el('span', { class: 'cal-day' }, String(day)),
      count > 0 ? el('span', { class: 'cal-dot' }) : null,
      count > 1 ? el('span', { class: 'cal-count' }, String(count)) : null
    );
    grid.appendChild(cell);
  }

  return el('div', { class: 'cal-container' }, header, weekRow, grid);
}

/**
 * Parse tasks into a Map<dateStr, count> and a Map<dateStr, todo[]>.
 */
export function buildCalendarData(todos) {
  const countMap = new Map();
  const todoMap = new Map();
  for (const t of todos) {
    if (!t.dueDate) continue;
    const key = t.dueDate.slice(0, 10);
    countMap.set(key, (countMap.get(key) || 0) + 1);
    if (!todoMap.has(key)) todoMap.set(key, []);
    todoMap.get(key).push(t);
  }
  return { countMap, todoMap };
}
