import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { buildMonthCalendar, buildRosterEvents, createRosterIcs, getMonthBounds, shiftMonth } from '../src/lib/calendar.js';
import { getLocalDate, getStatusForDate } from '../src/lib/roster.js';

const config = { workDays: 7, restDays: 7, startDate: '2026-09-01' };

test('el día actual sigue la fecha local aunque en UTC ya sea mañana', () => {
  const moduleUrl = new URL('../src/lib/roster.js', import.meta.url).href;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', `import { getLocalDate } from ${JSON.stringify(moduleUrl)}; console.log(getLocalDate(new Date('2026-09-14T01:15:00Z')))`], { env: { ...process.env, TZ: 'America/Argentina/Buenos_Aires' }, encoding: 'utf8' });
  assert.equal(result.trim(), '2026-09-13');
  assert.equal(getLocalDate(new Date('invalid')), null);
});

test('el calendario cubre febrero bisiesto y alinea las semanas de lunes a domingo', () => {
  const calendar = buildMonthCalendar('2028-02', config);
  assert.equal(calendar.days.length, 29);
  assert.equal(calendar.cells.length % 7, 0);
  assert.equal(calendar.cells[0], null);
  assert.equal(calendar.cells[1].date, '2028-02-01');
  assert.equal(calendar.days.at(-1).date, '2028-02-29');
  assert.equal(calendar.summary.work + calendar.summary.rest + calendar.summary.leave, 29);
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(getMonthBounds('2026-13'), null);
});

test('separa licencia médica de descanso, adjunta planes y vuelve al roster base', () => {
  const changedConfig = { ...config, exceptions: [{ type: 'medical', startDate: '2026-09-03', endDate: '2026-09-05', label: 'Recuperación' }] };
  const calendar = buildMonthCalendar('2026-09', changedConfig, [{ id: 'one', date: '2026-09-04', title: 'Control' }, { date: '2026-10-04', title: 'Otro mes' }]);
  const medicalDay = calendar.days.find((day) => day.date === '2026-09-04');
  assert.equal(calendar.summary.leave, 3);
  assert.equal(medicalDay.kind, 'leave');
  assert.equal(medicalDay.tasks.length, 1);
  assert.equal(calendar.days.find((day) => day.date === '2026-09-06').kind, 'work');
  assert.equal(calendar.days.find((day) => day.date === '2026-09-08').kind, 'rest');
  assert.equal(getStatusForDate('2026-09-06', changedConfig).actualDay, 6);
});

test('exporta fases completas con fin exclusivo incluso al cambiar de año', () => {
  const events = buildRosterEvents('2026-12-30', 5, { workDays: 2, restDays: 2, startDate: '2026-12-30' });
  assert.deepEqual(events, [
    { startDate: '2026-12-30', endDate: '2027-01-01', kind: 'work' },
    { startDate: '2027-01-01', endDate: '2027-01-03', kind: 'rest' },
    { startDate: '2027-01-03', endDate: '2027-01-04', kind: 'work' },
  ]);
});

test('el archivo ICS mantiene días enteros y nunca incluye motivos médicos ni etiquetas privadas', () => {
  const ics = createRosterIcs({
    config: { ...config, exceptions: [{ type: 'medical', startDate: '2026-09-03', endDate: '2026-09-05', label: 'Diagnóstico privado\nBEGIN:VEVENT' }] },
    startDate: '2026-09-01', days: 10, generatedAt: new Date('2026-08-01T15:30:00Z'),
  });
  assert.match(ics, /DTSTAMP:20260801T153000Z\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260903\r\nDTEND;VALUE=DATE:20260906\r\nSUMMARY:RosterMax - Ausencia/);
  assert.equal(ics.includes('Diagnóstico'), false);
  assert.equal(ics.includes('medical'), false);
  assert.equal(ics.includes('TZID'), false);
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 4);
  assert.equal(ics.endsWith('END:VCALENDAR\r\n'), true);
});

test('un roster especial se exporta sólo dentro de sus fechas y sin huecos', () => {
  const changed = { ...config, exceptions: [{ type: 'special_roster', mode: 'cycle', startDate: '2026-09-03', endDate: '2026-09-06', cycleStartDate: '2026-09-03', workDays: 1, restDays: 1 }] };
  const events = buildRosterEvents('2026-09-01', 10, changed);
  for (let index = 1; index < events.length; index += 1) assert.equal(events[index].startDate, events[index - 1].endDate);
  assert.equal(events[0].startDate, '2026-09-01');
  assert.equal(events.at(-1).endDate, '2026-09-11');
  assert.ok(events.some((event) => event.startDate === '2026-09-07' && event.kind === 'work'));
  assert.throws(() => buildRosterEvents('2026-02-30', 90, config), RangeError);
});
