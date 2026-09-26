import test from 'node:test';
import assert from 'node:assert/strict';
import { describeRosterDay } from '../src/lib/simulator.js';
import { getStatusForDate, sanitizeSharedExceptions } from '../src/lib/roster.js';

test('el simulador describe el día exacto de trabajo y franco', () => {
  const config = { workDays: 14, restDays: 7, startDate: '2026-09-01' };
  assert.equal(describeRosterDay(getStatusForDate('2026-09-10', config)).detail, 'Día 10 de 14 de trabajo');
  assert.equal(describeRosterDay(getStatusForDate('2026-09-19', config)).detail, 'Día 5 de 7 de franco');
});

test('un cambio temporal compartido conserva los días sin revelar el motivo médico', () => {
  const exceptions = sanitizeSharedExceptions([{ type: 'medical', mode: 'rest', startDate: '2026-09-15', endDate: '2026-09-21', label: 'Diagnóstico privado' }]);
  const result = describeRosterDay(getStatusForDate('2026-09-19', { workDays: 14, restDays: 7, startDate: '2026-09-01', exceptions }));
  assert.equal(result.detail, 'Día 5 de 7 de ausencia');
  assert.ok(!JSON.stringify(result).includes('Diagnóstico'));
});

test('no inventa un día de ciclo si faltan datos', () => {
  assert.equal(describeRosterDay({ error: 'Inválido' }).progress, null);
  assert.equal(describeRosterDay({ isWorking: true, actualDay: 20, totalPhaseDays: 7 }).detail, 'Día del ciclo no disponible');
});
