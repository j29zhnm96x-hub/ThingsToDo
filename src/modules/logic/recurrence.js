/**
 * Recurrence calculation utilities for recurring tasks.
 * Handles daily, weekly, monthly, and yearly patterns.
 */

import { generateId, nowIso } from '../data/models.js';

/**
 * Calculate the next due date based on recurrence settings.
 * Always normalizes to local midnight for consistency.
 * @param {string} currentDueDate - ISO date string of current due date
 * @param {string} recurrenceType - 'daily' | 'weekly' | 'monthly' | 'yearly'
 * @param {object} recurrenceDetails - Configuration for the recurrence
 * @returns {string|null} - Next due date as local-midnight ISO string, or null if invalid
 */
export function calculateNextDueDate(currentDueDate, recurrenceType, recurrenceDetails) {
  if (!currentDueDate || !recurrenceType) return null;
  
  const current = new Date(currentDueDate);
  if (isNaN(current.getTime())) return null;
  
  // Normalize anchor to local midnight
  current.setHours(0, 0, 0, 0);
  
  let next = new Date(current);
  
  switch (recurrenceType) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
      
    case 'weekly':
      next = calculateNextWeeklyDate(current, recurrenceDetails);
      break;
      
    case 'monthly':
      next = calculateNextMonthlyDate(current, recurrenceDetails);
      break;
      
    case 'yearly':
      next = calculateNextYearlyDate(current, recurrenceDetails);
      break;
      
    default:
      return null;
  }
  
  return next ? toDateOnlyIso(next) : null;
}

/**
 * Calculate next weekly occurrence.
 * @param {Date} current - Current date
 * @param {object} details - { days: [0-6] } where 0=Sunday, 1=Monday, etc.
 */
function calculateNextWeeklyDate(current, details) {
  const days = details?.days || [];
  if (!days.length) {
    // Default: same day next week
    const next = new Date(current);
    next.setDate(next.getDate() + 7);
    return next;
  }
  
  const currentDay = current.getDay();
  let minDaysAhead = 8; // More than a week
  
  for (const day of days) {
    let daysAhead = day - currentDay;
    if (daysAhead <= 0) daysAhead += 7; // Must be in future
    if (daysAhead < minDaysAhead) minDaysAhead = daysAhead;
  }
  
  const next = new Date(current);
  next.setDate(next.getDate() + minDaysAhead);
  return next;
}

/**
 * Calculate next monthly occurrence.
 * @param {Date} current - Current date
 * @param {object} details - { type: 'date'|'weekday', value: number, weekdayOrdinal?: number }
 */
function calculateNextMonthlyDate(current, details) {
  const type = details?.type || 'date';
  const next = new Date(current);
  
  if (type === 'date') {
    // Same date each month (e.g., 15th)
    const targetDate = details?.value || current.getDate();
    next.setMonth(next.getMonth() + 1);
    
    // Handle months with fewer days (e.g., 31st in February)
    const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(targetDate, daysInMonth));
  } else if (type === 'weekday') {
    // Nth weekday of month (e.g., 2nd Tuesday)
    const ordinal = details?.weekdayOrdinal || 1; // 1st, 2nd, 3rd, 4th, 5th
    const weekday = details?.value ?? current.getDay(); // 0-6
    
    next.setMonth(next.getMonth() + 1);
    next.setDate(1);
    
    // Find the nth occurrence of the weekday
    let count = 0;
    while (count < ordinal) {
      if (next.getDay() === weekday) count++;
      if (count < ordinal) next.setDate(next.getDate() + 1);
    }
  }
  
  return next;
}

/**
 * Calculate next yearly occurrence.
 * @param {Date} current - Current date
 * @param {object} details - Similar to monthly, can specify date or weekday pattern
 */
function calculateNextYearlyDate(current, details) {
  const type = details?.type || 'date';
  const next = new Date(current);
  
  if (type === 'date') {
    // Same date each year
    next.setFullYear(next.getFullYear() + 1);
    
    // Handle leap year (Feb 29)
    if (current.getMonth() === 1 && current.getDate() === 29) {
      const daysInFeb = new Date(next.getFullYear(), 2, 0).getDate();
      next.setDate(Math.min(29, daysInFeb));
    }
  } else if (type === 'weekday') {
    // Nth weekday of specific month (e.g., 3rd Thursday of November)
    const ordinal = details?.weekdayOrdinal || 1;
    const weekday = details?.value ?? current.getDay();
    const month = details?.month ?? current.getMonth();
    
    next.setFullYear(next.getFullYear() + 1);
    next.setMonth(month);
    next.setDate(1);
    
    let count = 0;
    while (count < ordinal) {
      if (next.getDay() === weekday) count++;
      if (count < ordinal) next.setDate(next.getDate() + 1);
    }
  }
  
  return next;
}

/**
 * Check if recurrence has reached its end condition.
 * @param {object} todo - The todo with recurrence settings
 * @returns {boolean} - True if recurrence should end
 */
export function hasRecurrenceEnded(todo) {
  if (!todo.recurrenceType) return true;
  if (todo.recurrenceEndType === 'never') return false;
  
  if (todo.recurrenceEndType === 'occurrences') {
    const maxOccurrences = parseInt(todo.recurrenceEndValue, 10) || 1;
    return (todo.recurrenceCount || 0) >= maxOccurrences;
  }
  
  if (todo.recurrenceEndType === 'date') {
    const endDate = new Date(todo.recurrenceEndValue);
    const nextDue = new Date(todo.dueDate);
    return nextDue > endDate;
  }
  
  return false;
}

/**
 * Check if a recurring task is due today (for spawning in inbox).
 * @param {string} dueDate - ISO date string
 * @returns {boolean}
 */
export function isDueToday(dueDate) {
  if (!dueDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  return due.getTime() === today.getTime();
}

/**
 * Check if a date is today or in the past.
 * @param {string} dueDate - ISO date string
 * @returns {boolean}
 */
export function isDueNowOrPast(dueDate) {
  if (!dueDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  return due.getTime() <= today.getTime();
}

/**
 * Create the next instance of a recurring task.
 * Calculates from the completed instance's anchor date (normalized to local midnight).
 * Instance is persisted but only returned if due today or earlier.
 * @param {object} completedTodo - The todo that was just completed
 * @param {object} db - Database instance
 * @returns {object|null} - The new todo instance if due today, or null
 */
export async function createNextRecurringInstance(completedTodo, db) {
  if (!completedTodo.recurrenceType) return null;
  if (hasRecurrenceEnded(completedTodo)) return null;
  
  // Use the anchor date from the completed instance (prefer dueDate, fallback to createdAt)
  const anchorDate = completedTodo.dueDate || completedTodo.createdAt;
  
  const nextDueDate = calculateNextDueDate(
    anchorDate,
    completedTodo.recurrenceType,
    completedTodo.recurrenceDetails
  );
  
  if (!nextDueDate) return null;
  
  // Check if end condition would be met after this new instance
  const newCount = (completedTodo.recurrenceCount || 0) + 1;
  
  if (completedTodo.recurrenceEndType === 'occurrences') {
    const maxOccurrences = parseInt(completedTodo.recurrenceEndValue, 10) || 1;
    if (newCount >= maxOccurrences) return null;
  }
  
  if (completedTodo.recurrenceEndType === 'date') {
    const endDate = new Date(completedTodo.recurrenceEndValue);
    endDate.setHours(0, 0, 0, 0);
    const nextDue = new Date(nextDueDate);
    if (nextDue > endDate) return null;
  }
  
  // Create new instance
  const newTodo = {
    ...completedTodo,
    id: generateId(),
    completed: false,
    completedAt: null,
    archived: false,
    archivedAt: null,
    dueDate: nextDueDate,
    recurrenceCount: newCount,
    isRecurringInstance: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  
  // Remove archived-specific fields
  delete newTodo.archivedFromProjectId;
  
  await db.todos.put(newTodo);
  
  // Only return the instance if it's due today or earlier (for immediate UI display)
  // Future instances stay in DB and will appear when their due date arrives
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDue = new Date(nextDueDate);
  nextDue.setHours(0, 0, 0, 0);
  
  if (nextDue.getTime() <= today.getTime()) {
    return newTodo;
  }
  
  // Instance created but not yet due - don't return for immediate display
  return null;
}

/**
 * End a recurring series - delete all future instances.
 * @param {string} seriesId - The series UUID
 * @param {object} db - Database instance
 */
export async function endRecurringSeries(seriesId, db) {
  if (!seriesId) return;
  
  // Get all active (non-archived) todos in this series
  const allTodos = await db.todos.listActive();
  const seriesTodos = allTodos.filter(t => t.seriesId === seriesId && !t.completed);
  
  // Delete future instances (non-completed)
  for (const todo of seriesTodos) {
    await db.todos.delete(todo.id);
  }
}

/**
 * Process all recurring tasks on app load - spawn any due tasks.
 * @param {object} db - Database instance
 */
export async function processRecurringTasks(db) {
  // This function is called on app load to check if any recurring
  // tasks need to spawn new instances. The logic is:
  // - Check all active (non-archived) recurring todos
  // - If a recurring task is completed but was the "template", spawn next
  // - Actually, our model: when you complete a task, we immediately spawn next
  // So this function mainly handles edge cases like app being closed
  
  // For simplicity, our model is:
  // 1. User completes a recurring task
  // 2. We immediately calculate and create the next instance
  // 3. The next instance only shows in Inbox when its dueDate arrives
  
  // No special processing needed on app load for now.
  // The visibility is handled by the Inbox filter.
}

/**
 * Get human-readable recurrence description.
 * @param {object} todo - Todo with recurrence settings
 * @param {function} t - Translation function
 * @returns {string}
 */
export function getRecurrenceDescription(todo, t) {
  if (!todo.recurrenceType) return '';
  
  let desc = '';
  
  switch (todo.recurrenceType) {
    case 'daily':
      desc = t('repeatsDaily') || 'Repeats daily';
      break;
    case 'weekly':
      const days = todo.recurrenceDetails?.days || [];
      if (days.length === 0) {
        desc = t('repeatsWeekly') || 'Repeats weekly';
      } else {
        const dayNames = [
          t('sun') || 'Sun', t('mon') || 'Mon', t('tue') || 'Tue',
          t('wed') || 'Wed', t('thu') || 'Thu', t('fri') || 'Fri', t('sat') || 'Sat'
        ];
        const selectedDays = days.map(d => dayNames[d]).join(', ');
        desc = `${t('repeatsWeeklyOn') || 'Repeats weekly on'} ${selectedDays}`;
      }
      break;
    case 'monthly':
      if (todo.recurrenceDetails?.type === 'weekday') {
        const ordinals = [t('first') || '1st', t('second') || '2nd', t('third') || '3rd', t('fourth') || '4th', t('fifth') || '5th'];
        const dayNames = [
          t('sunday') || 'Sunday', t('monday') || 'Monday', t('tuesday') || 'Tuesday',
          t('wednesday') || 'Wednesday', t('thursday') || 'Thursday', t('friday') || 'Friday', t('saturday') || 'Saturday'
        ];
        const ord = ordinals[(todo.recurrenceDetails.weekdayOrdinal || 1) - 1];
        const day = dayNames[todo.recurrenceDetails.value || 0];
        desc = `${t('repeatsMonthlyOnThe') || 'Repeats monthly on the'} ${ord} ${day}`;
      } else {
        desc = t('repeatsMonthly') || 'Repeats monthly';
      }
      break;
    case 'yearly':
      desc = t('repeatsYearly') || 'Repeats yearly';
      break;
  }
  
  // Add end condition
  if (todo.recurrenceEndType === 'date' && todo.recurrenceEndValue) {
    const endDate = new Date(todo.recurrenceEndValue).toLocaleDateString();
    desc += ` (${t('until') || 'until'} ${endDate})`;
  } else if (todo.recurrenceEndType === 'occurrences' && todo.recurrenceEndValue) {
    const remaining = (parseInt(todo.recurrenceEndValue, 10) || 1) - (todo.recurrenceCount || 0);
    desc += ` (${remaining} ${t('timesRemaining') || 'times remaining'})`;
  }
  
  return desc;
}

/**
 * Convert Date to local-midnight ISO string.
 * Normalizes to 00:00:00.000 in local timezone for consistent date comparisons.
 * @param {Date} date
 * @returns {string}
 */
function toDateOnlyIso(date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized.toISOString();
}

/**
 * Get today's date as ISO string.
 * @returns {string}
 */
export function getTodayIso() {
  return toDateOnlyIso(new Date());
}
