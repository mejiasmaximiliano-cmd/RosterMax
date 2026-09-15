import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSharedExceptions } from '../src/lib/sharedSchedule.js';
import {
  getNextTransition,
  getStatusForDate,
  isRestAvailable,
  sanitizeSharedExceptions,
  validateRosterConfig,
  validateScheduleException,
} from '../src/lib/roster.js';

const roster14x14 = { workDays: 14, restDays: 14, startDate: '2026-08-07' };

test('calcula el primer y último día de trabajo', () => {
  assert.deepEqual(getStatusForDate('2026-08-07', roster14x14), {
    isWorking: true,
    actualDay: 1,
    totalPhaseDays: 14,
    daysLeftInPhase: 14,
    daysUntilTransition: 14,
  });
  assert.equal(getStatusForDate('2026-08-20', roster14x14).actualDay, 14);
});

test('cambia a descanso al terminar la fase de trabajo', () => {
  const status = getStatusForDate('2026-08-21', roster14x14);
  assert.equal(status.isWorking, false);
  assert.equal(status.actualDay, 1);
  assert.equal(status.daysUntilTransition, 14);
});

test('calcula fechas anteriores al inicio sin marcarlas como descanso por error', () => {
  const status = getStatusForDate('2026-08-06', roster14x14);
  assert.equal(status.isWorking, false);
  assert.equal(status.actualDay, 14);
});

test('rechaza configuraciones inválidas', () => {
  assert.equal(validateRosterConfig({ workDays: 0, restDays: 14, startDate: '2026-08-07' }).valid, false);
  assert.equal(validateRosterConfig({ workDays: 14, restDays: 14, startDate: 'fecha' }).valid, false);
});

test('calcula la próxima bajada y subida', () => {
  const januaryRoster = { ...roster14x14, startDate: '2026-01-01' };
  assert.deepEqual(getNextTransition('2026-01-14', januaryRoster), {
    date: '2026-01-15', daysUntil: 1, nextStatus: 'rest',
  });
  assert.deepEqual(getNextTransition('2026-01-28', januaryRoster), {
    date: '2026-01-29', daysUntil: 1, nextStatus: 'work',
  });
});

test('aplica vacaciones temporalmente y luego vuelve al roster base', () => {
  const config = {
    ...roster14x14,
    exceptions: [{ type: 'vacation', mode: 'rest', label: 'Vacaciones', startDate: '2026-08-10', endDate: '2026-08-16' }],
  };
  const vacation = getStatusForDate('2026-08-12', config);
  assert.equal(vacation.isWorking, false);
  assert.equal(vacation.exceptionType, 'vacation');
  assert.equal(getStatusForDate('2026-08-17', config).isWorking, true);
  assert.deepEqual(getNextTransition('2026-08-09', config), { date: '2026-08-10', daysUntil: 1, nextStatus: 'rest' });
});

test('usa un roster especial dentro del período sin desplazar el roster normal', () => {
  const config = {
    ...roster14x14,
    exceptions: [{
      type: 'special_roster', mode: 'cycle', startDate: '2026-08-10', endDate: '2026-08-18',
      workDays: 2, restDays: 2, cycleStartDate: '2026-08-10',
    }],
  };
  assert.equal(getStatusForDate('2026-08-12', config).isWorking, false);
  assert.equal(getStatusForDate('2026-08-14', config).isWorking, true);
  assert.equal(getStatusForDate('2026-08-19', config).isWorking, true);
});

test('valida solapamientos y elimina motivos privados al compartir', () => {
  const existing = [{ id: 'one', startDate: '2026-09-01', endDate: '2026-09-07' }];
  assert.equal(validateScheduleException({ type: 'medical', startDate: '2026-09-05', endDate: '2026-09-08' }, existing).valid, false);
  const shared = sanitizeSharedExceptions([{ type: 'medical', label: 'Diagnóstico privado', startDate: '2026-09-10', endDate: '2026-09-12' }]);
  assert.deepEqual(decodeSharedExceptions(shared), [{ type: 'unavailable', mode: 'rest', startDate: '2026-09-10', endDate: '2026-09-12' }]);
  assert.equal(shared.every((item) => typeof item === 'string'), true);
});

test('una carpeta médica no se convierte en un franco al compartirla', () => {
  const exceptions = [{ type: 'medical', label: 'Motivo reservado', startDate: '2026-08-10', endDate: '2026-08-12' }];
  const ownStatus = getStatusForDate('2026-08-11', { ...roster14x14, exceptions });
  const sharedStatus = getStatusForDate('2026-08-11', { ...roster14x14, exceptions: sanitizeSharedExceptions(exceptions) });
  assert.equal(ownStatus.isWorking, false);
  assert.equal(isRestAvailable(ownStatus), false);
  assert.equal(isRestAvailable(sharedStatus), false);
  assert.equal(sharedStatus.exceptionLabel, 'No disponible');
  assert.equal(isRestAvailable(getStatusForDate('2026-08-21', roster14x14)), true);
  assert.equal(isRestAvailable({ error: 'Fecha inválida' }), false);
});

test('vacaciones siguen disponibles sin revelar el tipo de ausencia al equipo', () => {
  const shared = sanitizeSharedExceptions([{ type: 'vacation', label: 'Viaje privado', startDate: '2026-08-10', endDate: '2026-08-12' }]);
  assert.equal(decodeSharedExceptions(shared)[0].type, 'rest_override');
  assert.equal(isRestAvailable(getStatusForDate('2026-08-11', { ...roster14x14, exceptions: shared })), true);
});

test('rechaza cambios superpuestos aunque los anteriores no tengan id', () => {
  assert.equal(validateScheduleException({ type: 'leave', startDate: '2026-09-01', endDate: '2026-09-03' }, [{ startDate: '2026-09-02', endDate: '2026-09-04' }]).valid, false);
});

test('limita nuevos cambios a 30 y permite editar uno existente', () => {
  const existing = Array.from({ length: 30 }, (_, index) => ({ id: String(index), startDate: '2026-01-01', endDate: '2026-01-01' }));
  const input = { type: 'leave', startDate: '2026-09-01', endDate: '2026-09-03' };
  assert.equal(validateScheduleException(input, existing).valid, false);
  assert.equal(validateScheduleException({ ...input, id: '0' }, existing).valid, true);
});
