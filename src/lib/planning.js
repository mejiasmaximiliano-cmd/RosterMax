import { addDaysToDate, getStatusForDate, isRestAvailable, parseDateOnly } from './roster.js';

export const TASK_CATEGORIES = {
  personal: 'Personal', family: 'Familia', health: 'Salud', paperwork: 'Trámites', learning: 'Formación',
};

function safeMinutes(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

export function getNextRestWindow(startDate, config, horizonDays = 366) {
  if (parseDateOnly(startDate) === null || !Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 1464) return null;
  let start = null;
  let days = 0;
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = addDaysToDate(startDate, offset);
    const status = getStatusForDate(date, config);
    if (status.error) return null;
    if (isRestAvailable(status)) {
      if (!start) start = date;
      days += 1;
    } else if (start) {
      const endDate = addDaysToDate(date, -1);
      return { startDate: start, endDate, days };
    }
  }
  if (start) {
    const nextStatus = getStatusForDate(addDaysToDate(startDate, horizonDays), config);
    return {
      startDate: start, endDate: addDaysToDate(startDate, horizonDays - 1), days,
      ...(isRestAvailable(nextStatus) ? { continuesBeyondHorizon: true } : {}),
    };
  }
  return null;
}

export function getUpcomingRestWindows(startDate, config, { limit = 3, horizonDays = 366 } = {}) {
  if (parseDateOnly(startDate) === null || !Number.isInteger(limit) || limit < 1 || limit > 12 || !Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 1464) return [];
  const windows = [];
  let cursor = startDate;
  const end = addDaysToDate(startDate, horizonDays - 1);
  while (windows.length < limit && cursor <= end) {
    const remainingDays = Math.round((parseDateOnly(end) - parseDateOnly(cursor)) / 86400000) + 1;
    const window = getNextRestWindow(cursor, config, remainingDays);
    if (!window) break;
    windows.push(window);
    cursor = addDaysToDate(window.endDate, 1);
  }
  return windows;
}

export function getTaskSummary(tasks, today) {
  const open = (tasks || []).filter((task) => !task.completed);
  const completed = (tasks || []).filter((task) => task.completed);
  const overdue = open.filter((task) => task.date && task.date < today);
  const minutesPending = open.reduce((total, task) => total + safeMinutes(task.estimatedMinutes), 0);
  return { open: open.length, completed: completed.length, overdue: overdue.length, minutesPending };
}

export function getRestPlanSummary(tasks, restWindow, today) {
  const planned = restWindow ? (tasks || []).filter((task) => (
    parseDateOnly(task.date) !== null && task.date >= restWindow.startDate && task.date <= restWindow.endDate
  )) : [];
  return getTaskSummary(planned, today);
}

export function validateTask(input) {
  const title = String(input?.title || '').trim();
  const date = String(input?.date || '');
  const estimatedMinutes = Number(input?.estimatedMinutes || 0);
  if (!title || title.length > 140) return { valid: false, error: 'Escribe un plan de entre 1 y 140 caracteres.' };
  if (parseDateOnly(date) === null) return { valid: false, error: 'Elige una fecha válida para tu plan.' };
  if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 0 || estimatedMinutes > 1440) return { valid: false, error: 'La duración debe estar entre 0 y 1440 minutos.' };
  return {
    valid: true,
    task: {
      ...(input.id ? { id: String(input.id) } : {}),
      title, date, category: TASK_CATEGORIES[input.category] ? input.category : 'personal',
      priority: ['high', 'medium', 'low'].includes(input.priority) ? input.priority : 'medium',
      estimatedMinutes, completed: Boolean(input.completed),
    },
  };
}

export function sortTasks(tasks) {
  const priority = { high: 0, medium: 1, low: 2 };
  return [...(tasks || [])].sort((left, right) => (
    Number(left.completed) - Number(right.completed)
    || String(left.date || '9999-12-31').localeCompare(String(right.date || '9999-12-31'))
    || (priority[left.priority] ?? 1) - (priority[right.priority] ?? 1)
  ));
}
