import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSharedExceptions, encodeSharedExceptions } from '../src/lib/sharedSchedule.js';

test('roundtrip conserva disponibilidad y ciclo sin transportar notas privadas', () => {
  const source = [
    { type: 'unavailable', mode: 'rest', startDate: '2026-09-13', endDate: '2026-09-20', label: 'motivo privado' },
    { type: 'rest_override', mode: 'rest', startDate: '2026-10-01', endDate: '2026-10-08' },
    { type: 'extra_work', mode: 'work', startDate: '2026-10-15', endDate: '2026-10-16' },
    { type: 'special_roster', mode: 'cycle', startDate: '2026-11-01', endDate: '2026-11-30', workDays: 7, restDays: 4, cycleStartDate: '2026-10-29' },
  ];
  const wire = encodeSharedExceptions(source);
  assert.equal(wire[0], 'N|2026-09-13|2026-09-20');
  assert.equal(wire[3], 'C|2026-11-01|2026-11-30|7|4|2026-10-29');
  assert.ok(!wire.join('').includes('privado'));
  const expected = source.map(({ label, ...availability }) => { void label; return availability; });
  assert.deepEqual(decodeSharedExceptions(wire), expected);
});

test('el formato público rechaza motivos de licencia e intervalos inválidos', () => {
  const base = { type: 'unavailable', mode: 'rest', startDate: '2026-09-13', endDate: '2026-09-20' };
  for (const changes of [{ type: 'medical' }, { type: 'leave' }, { type: 'toString' }, { startDate: '2026-02-30' }, { endDate: '2026-09-01' }, { mode: 'work' }]) {
    assert.throws(() => encodeSharedExceptions([{ ...base, ...changes }]));
  }
  assert.deepEqual(decodeSharedExceptions([
    'medical|2026-09-13|2026-09-20', 'N|2026-02-30|2026-09-20',
    'N|2026-09-13|2026-09-20|diagnosis', 'C|2026-09-13|2026-09-20|0|7|2026-09-13',
    'C|2026-09-13|2026-09-20|7|366|2026-09-13', 'toString|2026-09-13|2026-09-20', null, {},
  ]), []);
});

test('30 cambios se conservan completos y un exceso se informa en vez de truncar', () => {
  const changes = Array.from({ length: 30 }, (_, index) => ({
    type: 'extra_work', mode: 'work', startDate: `2026-09-${String(index + 1).padStart(2, '0')}`,
    endDate: `2026-09-${String(index + 1).padStart(2, '0')}`,
  }));
  assert.deepEqual(decodeSharedExceptions(encodeSharedExceptions(changes)), changes);
  assert.throws(() => encodeSharedExceptions([...changes, changes[0]]), /30 cambios/);
});
