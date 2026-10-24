import test from 'node:test';
import assert from 'node:assert/strict';
import { changeRosterConfiguration, encodeRosterHistory, decodeRosterHistory, rosterForDate } from '../src/lib/rosterHistory.js';
import { getStatusForDate, addDaysToDate } from '../src/lib/roster.js';
import { buildRosterEvents } from '../src/lib/calendar.js';
import { findRestCoincidences } from '../src/lib/coincidences.js';

const base = { workDays: 7, restDays: 7, startDate: '2023-12-25' };
test('vigencias conservan cada día anterior y cubren bisiesto, años y ciclos personalizados', () => {
  for (const [workDays, restDays] of [[7,7], [14,14], [14,7], [11,5]]) {
    const config = changeRosterConfiguration(base, { workDays, restDays, startDate: '2024-02-29' }, { mode: 'change', effectiveDate: '2024-02-29' });
    for (let i = 0; i < 180; i++) {
      const date = addDaysToDate('2023-09-02', i);
      if (date < '2024-02-29') assert.deepEqual(getStatusForDate(date, config), getStatusForDate(date, base));
    }
    assert.deepEqual(getStatusForDate('2024-02-29', config), getStatusForDate('2024-02-29', { workDays, restDays, startDate: '2024-02-29' }));
  }
});
test('correcciones son explícitas y no eliminan otras vigencias', () => {
  let c = changeRosterConfiguration(base, { workDays: 14, restDays: 7, startDate: '2024-03-01' }, { mode: 'change', effectiveDate: '2024-03-01' });
  c = changeRosterConfiguration(c, { workDays: 14, restDays: 14, startDate: '2024-03-02' }, { mode: 'correction', effectiveDate: '2024-06-01' });
  assert.equal(c.workDays, 7); assert.equal(c.periods.length, 1);
  assert.equal(rosterForDate(c, '2024-06-01').restDays, 14);
  assert.throws(() => changeRosterConfiguration(c, base, { mode: 'change', effectiveDate: '2024-03-01' }));
});
test('excepciones que cruzan períodos, formato compartido, coincidencias y exportaciones usan el mismo historial', () => {
  const c = changeRosterConfiguration(base, { workDays: 14, restDays: 7, startDate: '2024-03-01' }, { mode: 'change', effectiveDate: '2024-03-01' });
  c.exceptions = [{ type: 'extra_work', mode: 'work', startDate: '2024-02-27', endDate: '2024-03-04' }];
  const wire = encodeRosterHistory(c);
  const shared = { workDays: 14, restDays: 7, startDate: '2024-03-01', history: wire, exceptions: c.exceptions };
  assert.ok(decodeRosterHistory(wire));
  for (let i = 0; i < 732; i++) {
    const date = addDaysToDate('2023-12-01', i);
    assert.deepEqual(getStatusForDate(date, shared), getStatusForDate(date, c));
  }
  assert.equal(getStatusForDate('2024-03-02', c).exceptionType, 'extra_work');
  assert.deepEqual(buildRosterEvents('2024-02-01', 90, shared), buildRosterEvents('2024-02-01', 90, c));
  assert.deepEqual(findRestCoincidences('2024-02-01', shared, [{ id: 'a', ...base }]), findRestCoincidences('2024-02-01', c, [{ id: 'a', ...base }]));
  assert.equal(decodeRosterHistory(wire + ';P|nota privada'), null);
});
