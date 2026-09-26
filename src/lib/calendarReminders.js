import { parseDateOnly } from './roster.js';

const encoder = new TextEncoder();
const MAX_REMINDER_MINUTES = 7 * 24 * 60;
const MAX_AMOUNT = 1000000000000;

// RFC 5545: TEXT escapes, CRLF content lines, and folds limited to 75 octets.
// DTSTART intentionally uses floating local time: the importing calendar's
// local-time rules apply. No TZID or UTC conversion is implied.
export function escapeCalendarText(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .split('').filter((character) => character === '\t' || (character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)).join('');
}

export function foldCalendarLine(line) {
  if (typeof line !== 'string' || /[\r\n]/.test(line)) throw new TypeError('Una línea de calendario no puede contener saltos sin escapar.');
  const segments = [];
  let segment = '';
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      segments.push(segment);
      segment = ' ';
      bytes = 1;
    }
    segment += character;
    bytes += size;
  }
  segments.push(segment);
  return segments.join('\r\n');
}

function validateReminder({ item, date, time, reminderMinutes, monthly, includeTitle, generatedAt }) {
  if (!item || typeof item.id !== 'string' || !item.id.trim() || item.id.length > 200) throw new RangeError('Guarda primero el plan o la meta para crear su recordatorio.');
  if (parseDateOnly(date) === null) throw new RangeError('Elige una fecha válida para el recordatorio.');
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new RangeError('Elige una hora válida entre 00:00 y 23:59.');
  if (typeof reminderMinutes !== 'number' || !Number.isInteger(reminderMinutes) || reminderMinutes < 0 || reminderMinutes > MAX_REMINDER_MINUTES) throw new RangeError('El aviso debe estar entre 0 minutos y 7 días antes.');
  if (typeof monthly !== 'boolean' || typeof includeTitle !== 'boolean') throw new TypeError('Revisa las opciones del recordatorio.');
  if (!(generatedAt instanceof Date) || !Number.isFinite(generatedAt.getTime())) throw new RangeError('La fecha de creación del recordatorio es inválida.');
  if (includeTitle && (typeof item.title !== 'string' || !item.title.trim() || item.title.length > 200)) throw new RangeError('El nombre del plan o la meta es inválido.');
}

function monthlyRule(date) {
  const day = Number(date.slice(-2));
  if (day <= 28) return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${day}`;
  // Select the requested day, or February's last day when it is shorter.
  // In particular a 31st-day reminder also runs on April 30, not in May only.
  const days = Array.from({ length: day - 27 }, (_, index) => index + 28);
  return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${days.join(',')};BYSETPOS=-1`;
}

function reminderDetails({ kind, item, date, time, reminderMinutes, monthly, includeTitle, generatedAt, durationMinutes }) {
  validateReminder({ item, date, time, reminderMinutes, monthly, includeTitle, generatedAt });
  const summary = kind === 'goal' ? 'RosterMax: revisar mi ahorro' : 'RosterMax: revisar mi plan';
  const title = includeTitle ? `${summary} - ${item.title.trim()}` : summary;
  const description = kind === 'goal'
    ? 'Abre RosterMax para revisar tu meta y registrar un aporte si corresponde. Este recordatorio no realiza transferencias ni registra aportes automáticamente.'
    : 'Abre RosterMax para consultar tu plan. Este recordatorio no modifica la fecha ni el estado del plan.';
  const stamp = generatedAt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const start = `${date.replaceAll('-', '')}T${time.replace(':', '')}00`;
  const identity = Array.from(encoder.encode(item.id), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const [hours, minutes] = time.split(':').map(Number);
  const endDate = new Date(parseDateOnly(date) + (hours * 60 + minutes + durationMinutes) * 60000);
  if (endDate.getUTCFullYear() > 9999) throw new RangeError('El fin del recordatorio queda fuera del período permitido.');
  const end = endDate.toISOString().slice(0, 19).replace(/[-:]/g, '');
  return { title, description, stamp, start, end, uid: `rostermax-${kind}-${identity}@rostermax.app`, rule: monthly ? monthlyRule(date) : null, reminderMinutes, durationMinutes };
}

function buildReminderIcs(options) {
  const { title, description, stamp, start, uid, rule, reminderMinutes, durationMinutes } = reminderDetails(options);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RosterMax//Recordatorios//ES',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`, `LAST-MODIFIED:${stamp}`, `DTSTART:${start}`,
    `DURATION:PT${durationMinutes}M`,
    `SUMMARY:${escapeCalendarText(title)}`,
    `DESCRIPTION:${escapeCalendarText(`${description}\nHora local del calendario. Importa el archivo y confirma sus avisos. Los cambios en RosterMax no actualizan este evento; modifícalo o elimínalo desde tu calendario.`)}`,
    'CLASS:PRIVATE', 'TRANSP:TRANSPARENT', 'STATUS:CONFIRMED',
  ];
  if (rule) lines.push(rule);
  lines.push(
    'BEGIN:VALARM', 'ACTION:DISPLAY',
    `TRIGGER:${reminderMinutes === 0 ? 'PT0M' : `-PT${reminderMinutes}M`}`,
    `DESCRIPTION:${escapeCalendarText(title)}`,
    'END:VALARM', 'END:VEVENT', 'END:VCALENDAR',
  );
  return `${lines.map(foldCalendarLine).join('\r\n')}\r\n`;
}

function planOptions({ plan, date = plan?.date, time = '09:00', reminderMinutes = 15, monthly = false, includeTitle = false, generatedAt = new Date() } = {}) {
  const estimate = plan?.estimatedMinutes ?? 0;
  if (typeof estimate !== 'number' || !Number.isInteger(estimate) || estimate < 0 || estimate > 1440) throw new RangeError('La duración del plan debe estar entre 0 y 1440 minutos.');
  return { kind: 'plan', item: plan, date, time, reminderMinutes, monthly, includeTitle, generatedAt, durationMinutes: estimate || 15 };
}

function goalOptions({ goal, date, time = '09:00', reminderMinutes = 0, monthly = true, includeTitle = false, generatedAt = new Date() } = {}) {
  const target = goal?.target;
  const current = goal?.current ?? 0;
  const monthlyPlan = goal?.monthlyPlan ?? 0;
  if ([target, current, monthlyPlan].some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) || target <= 0) throw new RangeError('Revisa los montos de la meta antes de crear su recordatorio.');
  if (current >= target) throw new RangeError('Esta meta ya está completada. Crea un recordatorio para otra meta pendiente.');
  return { kind: 'goal', item: goal, date, time, reminderMinutes, monthly, includeTitle, generatedAt, durationMinutes: 15 };
}

function buildGoogleCalendarUrl(options) {
  const { title, description, start, end, rule, reminderMinutes } = reminderDetails(options);
  const requestedAlert = reminderMinutes === 0 ? 'a la hora del evento' : `${reminderMinutes} minutos antes`;
  const params = new URLSearchParams({
    action: 'TEMPLATE', text: title, dates: `${start}/${end}`,
    details: `${description}\nHora local del calendario. Configura una notificación ${requestedAlert} y confirma la repetición antes de guardar. Los cambios en RosterMax no actualizan este evento; modifícalo o elimínalo desde tu calendario.`,
  });
  if (rule) params.set('recur', rule);
  // A pre-filled draft, not an authenticated write. Google notifications must
  // be configured/confirmed by the user; URL templates cannot enforce VALARM.
  // https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events
  return `https://calendar.google.com/calendar/r/eventedit?${params}`;
}

export function createPlanReminderIcs(options) {
  return buildReminderIcs(planOptions(options));
}

export function createGoalReminderIcs(options) {
  return buildReminderIcs(goalOptions(options));
}

export function createPlanGoogleCalendarUrl(options) {
  return buildGoogleCalendarUrl(planOptions(options));
}

export function createGoalGoogleCalendarUrl(options) {
  return buildGoogleCalendarUrl(goalOptions(options));
}
