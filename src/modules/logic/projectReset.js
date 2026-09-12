// Automatic checklist reset — daily, weekly (chosen weekday), or monthly (chosen day of month).
// Reset happens at the start of the chosen day (00:00). All completed items in the project
// (including sub-projects) are unchecked so the list is ready for the next cycle.

import { getAllTodosForProject } from './todoOps.js';

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Compute the most recent reset trigger date (YYYY-MM-DD) on or before today.
// Returns null when the interval is invalid or unset.
export function computeResetTriggerDate(interval, resetDay, now = new Date()) {
  if (!interval) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (interval === 'daily') {
    return toDateKey(today);
  }

  if (interval === 'weekly') {
    // resetDay: 0-6 (0=Sunday), same convention as Date.getDay()
    const target = typeof resetDay === 'number' && resetDay >= 0 && resetDay <= 6 ? resetDay : 0;
    const diff = (today.getDay() - target + 7) % 7;
    const trigger = new Date(today);
    trigger.setDate(today.getDate() - diff);
    return toDateKey(trigger);
  }

  if (interval === 'monthly') {
    // resetDay: 1-31; clamp to month length (Feb: 28/29)
    const target = typeof resetDay === 'number' && resetDay >= 1 && resetDay <= 31 ? resetDay : 1;
    const thisMonthLen = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const effectiveDay = Math.min(target, thisMonthLen);
    if (today.getDate() >= effectiveDay) {
      return toDateKey(new Date(today.getFullYear(), today.getMonth(), effectiveDay));
    }
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthLen = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
    const effPrev = Math.min(target, prevMonthLen);
    return toDateKey(new Date(prevMonth.getFullYear(), prevMonth.getMonth(), effPrev));
  }

  return null;
}

// Reset one project if its trigger date has passed since lastResetDate.
export async function maybeResetProject(db, project, projectsById) {
  if (!project || !project.resetInterval) return false;
  const trigger = computeResetTriggerDate(project.resetInterval, project.resetDay);
  if (!trigger) return false;
  if (project.lastResetDate && project.lastResetDate >= trigger) return false;

  const todos = await getAllTodosForProject(project.id, db, projectsById);
  for (const todo of todos) {
    if (todo.completed) {
      await db.todos.put({ ...todo, completed: false, completedAt: null });
    }
  }
  await db.projects.put({ ...project, lastResetDate: trigger });
  return true;
}

// Check and reset all checklist projects with a reset interval.
export async function runProjectResets(db) {
  try {
    const projects = await db.projects.list();
    const projectsById = new Map(projects.map((p) => [p.id, p]));
    for (const p of projects) {
      if (p.type !== 'checklist' || !p.resetInterval) continue;
      try {
        await maybeResetProject(db, p, projectsById);
      } catch (e) {
        console.error('Project reset failed', p.id, e);
      }
    }
  } catch (e) {
    console.error('runProjectResets failed', e);
  }
}
