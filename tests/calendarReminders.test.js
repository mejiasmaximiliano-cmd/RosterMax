import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoalGoogleCalendarUrl, createGoalReminderIcs, createPlanGoogleCalendarUrl, createPlanReminderIcs, escapeCalendarText, foldCalendarLine } from '../src/lib/calendarReminders.js';

const generatedAt = new Date('2026-09-25T12:34:56.789Z');
const plan = { id: 'plan-A1', title: 'Cita personal privada', date: '2026-09-27', estimatedMinutes: 90 };
const goal = { id: 'goal-B2', title: 'Meta personal privada', target: 987654.32, current: 87654.32, monthlyPlan: 45678.9, currency: 'ARS' };
const unfold = (contents) => contents.replace(/\r\n[ \t]/g, '');
const property = (contents, name) => unfold(contents).split('\r\n').find((line) => line.startsWith(`${name}:`))?.slice(name.length + 1);

test('exporta un plan con fecha/hora local flotante y aviso anticipado válido', () => {
  const ics = createPlanReminderIcs({ plan, time: '10:30', reminderMinutes: 60, generatedAt });
  assert.equal(property(ics, 'DTSTART'), '20260927T103000');
  assert.equal(property(ics, 'DTSTAMP'), '20260925T123456Z');
  assert.equal(property(ics, 'DURATION'), 'PT90M');
  assert.equal(property(ics, 'TRIGGER'), '-PT60M');
  assert.equal(property(ics, 'ACTION'), 'DISPLAY');
  assert.equal(property(ics, 'CLASS'), 'PRIVATE');
  assert.equal(property(ics, 'SUMMARY'), 'RosterMax: revisar mi plan');
  assert.ok(ics.includes('BEGIN:VALARM\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(ics.includes('TZID'), false);
  assert.equal(property(ics, 'RRULE'), undefined);
  assert.equal(unfold(ics).includes(plan.title), false);
});

test('la meta genera un aviso mensual sin publicar su título, moneda ni montos', () => {
  const ics = createGoalReminderIcs({ goal, date: '2026-10-10', time: '09:00', generatedAt });
  assert.equal(property(ics, 'SUMMARY'), 'RosterMax: revisar mi ahorro');
  assert.equal(property(ics, 'TRIGGER'), 'PT0M');
  assert.equal(property(ics, 'RRULE'), 'FREQ=MONTHLY;BYMONTHDAY=10');
  for (const privateValue of [goal.title, goal.currency, goal.target, goal.current, goal.monthlyPlan]) assert.equal(unfold(ics).includes(String(privateValue)), false);
  assert.match(property(ics, 'DESCRIPTION'), /no realiza transferencias/);
  assert.match(property(ics, 'DESCRIPTION'), /no actualizan este evento/);
});

test('la repetición mensual de días 29 a 31 usa el último día disponible de meses cortos', () => {
  for (const [day, rule] of [
    ['28', 'FREQ=MONTHLY;BYMONTHDAY=28'],
    ['29', 'FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1'],
    ['30', 'FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1'],
    ['31', 'FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1'],
  ]) {
    assert.equal(property(createGoalReminderIcs({ goal, date: `2026-10-${day}`, generatedAt }), 'RRULE'), rule);
  }
  const once = createGoalReminderIcs({ goal, date: '2026-10-31', monthly: false, generatedAt });
  assert.equal(property(once, 'RRULE'), undefined);
});

test('UID estable al cambiar fecha, hora, título y alarma; distinto por objeto y tipo', () => {
  const first = createPlanReminderIcs({ plan, generatedAt });
  const updated = createPlanReminderIcs({ plan: { ...plan, title: 'Nuevo nombre' }, date: '2026-10-01', time: '18:45', reminderMinutes: 5, generatedAt: new Date('2026-09-26T00:00:00Z') });
  assert.equal(property(first, 'UID'), property(updated, 'UID'));
  assert.notEqual(property(first, 'UID'), property(createPlanReminderIcs({ plan: { ...plan, id: 'otro-plan' }, generatedAt }), 'UID'));
  assert.notEqual(property(first, 'UID'), property(createGoalReminderIcs({ goal: { ...goal, id: plan.id }, date: plan.date, generatedAt }), 'UID'));
});

test('el nombre sólo se incluye con consentimiento y se escapan saltos e inyección de propiedades', () => {
  const title = 'Revisar; familia, viaje\\ruta\r\nBEGIN:VEVENT\nSUMMARY:intruso';
  const ics = createPlanReminderIcs({ plan: { ...plan, title }, includeTitle: true, generatedAt });
  const logical = unfold(ics);
  assert.equal(logical.split('\r\n').filter((line) => line === 'BEGIN:VEVENT').length, 1);
  assert.equal(logical.split('\r\n').filter((line) => line.startsWith('SUMMARY:')).length, 1);
  assert.match(property(ics, 'SUMMARY'), /familia\\, viaje\\\\ruta\\nBEGIN:VEVENT\\nSUMMARY:intruso/);
  assert.equal(escapeCalendarText('a;b,c\\d\r\ne\rf\ng'), 'a\\;b\\,c\\\\d\\ne\\nf\\ng');
});

test('pliega por bytes UTF-8 sin romper tildes ni emojis ni superar 75 octetos', () => {
  const line = `SUMMARY:${'Vacación 😀 Ñ '.repeat(30)}`;
  const folded = foldCalendarLine(line);
  const segments = folded.split('\r\n');
  assert.ok(segments.length > 2);
  for (const segment of segments) assert.ok(new TextEncoder().encode(segment).length <= 75);
  assert.equal(unfold(folded), line);
  assert.ok(segments.slice(1).every((segment) => segment.startsWith(' ')));
  const ics = createPlanReminderIcs({ plan: { ...plan, title: 'Ñandú 😀 '.repeat(20) }, includeTitle: true, generatedAt });
  for (const segment of ics.split('\r\n')) assert.ok(new TextEncoder().encode(segment).length <= 75);
  assert.equal(ics.replaceAll('\r\n', '').includes('\n'), false);
});

test('fecha inválida, hora incompleta y anticipación no válida se rechazan', () => {
  for (const date of ['', '2026-02-29', '2026-09-31', null, '2026-9-27']) assert.throws(() => createPlanReminderIcs({ plan, date, generatedAt }), /fecha válida/);
  for (const time of ['24:00', '12:60', '9:00', '', '09:00\nSUMMARY:otro', null]) assert.throws(() => createPlanReminderIcs({ plan, time, generatedAt }), /hora válida/);
  for (const reminderMinutes of [-1, 0.5, 10081, Infinity, NaN, null, '15']) assert.throws(() => createPlanReminderIcs({ plan, reminderMinutes, generatedAt }), /aviso debe estar/);
  assert.equal(property(createPlanReminderIcs({ plan, date: '2028-02-29', time: '00:00', reminderMinutes: 10080, generatedAt }), 'DTSTART'), '20280229T000000');
});

test('valida montos de metas, acepta plan de ahorro cero y rechaza metas completadas', () => {
  for (const badGoal of [{ ...goal, target: 0 }, { ...goal, target: Infinity }, { ...goal, current: -1 }, { ...goal, current: NaN }, { ...goal, monthlyPlan: '100' }, { ...goal, monthlyPlan: 1000000000001 }]) assert.throws(() => createGoalReminderIcs({ goal: badGoal, date: '2026-10-01', generatedAt }), /montos/);
  assert.throws(() => createGoalReminderIcs({ goal: { ...goal, current: goal.target }, date: '2026-10-01', generatedAt }), /ya está completada/);
  assert.ok(createGoalReminderIcs({ goal: { ...goal, monthlyPlan: 0 }, date: '2026-10-01', generatedAt }).includes('BEGIN:VALARM'));
});

test('valida identidad, duración y fecha de creación sin generar eventos rotos', () => {
  assert.throws(() => createPlanReminderIcs({ plan: { ...plan, id: '' }, generatedAt }), /Guarda primero/);
  assert.throws(() => createPlanReminderIcs({ plan: { ...plan, estimatedMinutes: -1 }, generatedAt }), /duración/);
  assert.throws(() => createPlanReminderIcs({ plan, generatedAt: new Date(NaN) }), /fecha de creación/);
  assert.throws(() => createPlanReminderIcs({ plan, monthly: 'mensual', generatedAt }), /opciones/);
  assert.throws(() => foldCalendarLine('SUMMARY:primero\r\nSUMMARY:segundo'), /saltos sin escapar/);
  assert.equal(property(createPlanReminderIcs({ plan: { ...plan, estimatedMinutes: 0 }, generatedAt }), 'DURATION'), 'PT15M');
});

test('Google Calendar recibe un borrador con hora flotante y fin que cruza medianoche correctamente', () => {
  const url = new URL(createPlanGoogleCalendarUrl({ plan, date: '2026-12-31', time: '23:30', reminderMinutes: 60, generatedAt }));
  assert.equal(url.origin, 'https://calendar.google.com');
  assert.equal(url.pathname, '/calendar/r/eventedit');
  assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('dates'), '20261231T233000/20270101T010000');
  assert.equal(url.searchParams.get('text'), 'RosterMax: revisar mi plan');
  assert.equal(url.searchParams.has('ctz'), false);
  assert.equal(url.searchParams.has('recur'), false);
  assert.equal(url.searchParams.has('reminders'), false);
  assert.match(url.searchParams.get('details'), /Configura una notificación 60 minutos antes/);
  assert.equal(decodeURIComponent(url.href).includes(plan.title), false);
});

test('Google Calendar comparte la regla mensual y la privacidad por defecto con ICS', () => {
  const options = { goal, date: '2026-10-31', generatedAt };
  const url = new URL(createGoalGoogleCalendarUrl(options));
  const ics = createGoalReminderIcs(options);
  assert.equal(url.searchParams.get('recur'), `RRULE:${property(ics, 'RRULE')}`);
  assert.equal(url.searchParams.get('text'), property(ics, 'SUMMARY'));
  assert.equal(url.searchParams.get('dates'), '20261031T090000/20261031T091500');
  for (const secret of [goal.title, goal.currency, String(goal.target), String(goal.current), String(goal.monthlyPlan)]) assert.equal(decodeURIComponent(url.href).includes(secret), false);
  const named = new URL(createGoalGoogleCalendarUrl({ ...options, includeTitle: true }));
  assert.ok(named.searchParams.get('text').includes(goal.title));
});

test('Google Calendar valida igual que ICS y codifica caracteres reservados del título', () => {
  assert.throws(() => createGoalGoogleCalendarUrl({ goal: { ...goal, target: NaN }, date: '2026-10-01', generatedAt }), /montos/);
  assert.throws(() => createPlanGoogleCalendarUrl({ plan, time: '99:00', generatedAt }), /hora válida/);
  assert.throws(() => createPlanGoogleCalendarUrl({ plan, date: '9999-12-31', time: '23:30', generatedAt }), /período permitido/);
  const title = 'Plan & invitado=privado / + # ☀️';
  const url = new URL(createPlanGoogleCalendarUrl({ plan: { ...plan, title }, includeTitle: true, generatedAt }));
  assert.equal(url.searchParams.get('text'), `RosterMax: revisar mi plan - ${title}`);
  assert.equal(url.searchParams.has('invitado'), false);
});
