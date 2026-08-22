import { addDaysToDate, getStatusForDate } from './roster.js';

export function getNextRestWindow(startDate, config, horizonDays = 366) {
  let start = null;
  for (let offset = 0; offset < horizonDays; offset += 1) {
    const date = addDaysToDate(startDate, offset);
    const status = getStatusForDate(date, config);
    if (status.error) return null;
    if (!status.isWorking && !start) start = date;
    if (status.isWorking && start) {
      const endDate = addDaysToDate(date, -1);
      const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
      return { startDate: start, endDate, days };
    }
  }
  return null;
}

export function getTaskSummary(tasks, today) {
  const open = (tasks || []).filter((task) => !task.completed);
  const completed = (tasks || []).filter((task) => task.completed);
  const overdue = open.filter((task) => task.date && task.date < today);
  const minutesPending = open.reduce((total, task) => total + Math.max(0, Number(task.estimatedMinutes || 0)), 0);
  return { open: open.length, completed: completed.length, overdue: overdue.length, minutesPending };
}

export function sortTasks(tasks) {
  const priority = { high: 0, medium: 1, low: 2 };
  return [...(tasks || [])].sort((left, right) => (
    Number(left.completed) - Number(right.completed)
    || String(left.date || '9999-12-31').localeCompare(String(right.date || '9999-12-31'))
    || (priority[left.priority] ?? 1) - (priority[right.priority] ?? 1)
  ));
}
