import { addDaysToDate, getStatusForDate, parseDateOnly, validateRosterConfig } from './roster.js';

export function getMonthBounds(month) {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) return null;
  const firstDate = `${month}-01`;
  const timestamp = parseDateOnly(firstDate);
  if (timestamp === null) return null;
  const date = new Date(timestamp);
  const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  const days = Math.round((nextMonth.getTime() - timestamp) / 86400000);
  return { firstDate, lastDate: addDaysToDate(firstDate, days - 1), days };
}

export function shiftMonth(month, amount) {
  const bounds = getMonthBounds(month);
  if (!bounds || !Number.isInteger(amount)) return null;
  const date = new Date(parseDateOnly(bounds.firstDate));
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1)).toISOString().slice(0, 7);
}

export function getCalendarDayKind(status) {
  if (!status || status.error) return 'unknown';
  if (status.isWorking) return 'work';
  if (['medical', 'leave', 'unavailable', 'vacation', 'rest_override'].includes(status.exceptionType)) return 'leave';
  return 'rest';
}

export function getCalendarDayLabel(status) {
  if (!status || status.error) return 'Sin roster válido';
  if (status.isOverride) return status.exceptionLabel || (status.isWorking ? 'Trabajo especial' : 'Descanso especial');
  return status.isWorking ? 'Trabajo' : 'Franco';
}

export function buildMonthCalendar(month, config, tasks = []) {
  const bounds = getMonthBounds(month);
  const validation = validateRosterConfig(config);
  if (!bounds || !validation.valid) {
    return { error: validation.error || 'Mes inválido', days: [], cells: [], summary: { work: 0, rest: 0, leave: 0 } };
  }
  const summary = { work: 0, rest: 0, leave: 0 };
  const tasksByDate = new Map();
  for (const task of tasks || []) {
    if (!task?.date || task.date.slice(0, 7) !== month) continue;
    tasksByDate.set(task.date, [...(tasksByDate.get(task.date) || []), task]);
  }
  const days = Array.from({ length: bounds.days }, (_, index) => {
    const date = addDaysToDate(bounds.firstDate, index);
    const status = getStatusForDate(date, config);
    const kind = getCalendarDayKind(status);
    summary[kind] += 1;
    return { date, day: index + 1, status, kind, label: getCalendarDayLabel(status), tasks: tasksByDate.get(date) || [] };
  });
  const mondayOffset = (new Date(parseDateOnly(bounds.firstDate)).getUTCDay() + 6) % 7;
  const cells = [...Array(mondayOffset).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  return { ...bounds, days, cells, summary };
}

// A calendar export deliberately contains only availability, never personal
// task titles, exception notes, or the medical reason behind an absence.
export function buildRosterEvents(startDate, days, config) {
  if (parseDateOnly(startDate) === null || !Number.isInteger(days) || days < 1 || days > 732) {
    throw new RangeError('Elige un período válido de entre 1 y 732 días.');
  }
  const validation = validateRosterConfig(config);
  if (!validation.valid) throw new RangeError(validation.error);
  const events = [];
  for (let index = 0; index < days; index += 1) {
    const date = addDaysToDate(startDate, index);
    const kind = getCalendarDayKind(getStatusForDate(date, config));
    const current = events.at(-1);
    if (current?.kind === kind) current.endDate = addDaysToDate(date, 1);
    else events.push({ startDate: date, endDate: addDaysToDate(date, 1), kind });
  }
  return events;
}

export function createRosterIcs({ config, startDate, days, generatedAt = new Date() }) {
  const events = buildRosterEvents(startDate, days, config);
  if (!(generatedAt instanceof Date) || Number.isNaN(generatedAt.getTime())) throw new RangeError('Fecha de exportación inválida.');
  const stamp = generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const labels = { work: 'Trabajo', rest: 'Franco', leave: 'Ausencia' };
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RosterMax//Mi roster//ES',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Mi roster',
  ];
  for (const event of events) {
    const start = event.startDate.replaceAll('-', '');
    const end = event.endDate.replaceAll('-', '');
    lines.push(
      'BEGIN:VEVENT', `UID:roster-${start}-${event.kind}@rostermax`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`, `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:RosterMax - ${labels[event.kind]}`, 'CLASS:PRIVATE',
      `TRANSP:${event.kind === 'rest' ? 'TRANSPARENT' : 'OPAQUE'}`, 'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}
