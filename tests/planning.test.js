import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextRestWindow, getRestPlanSummary, getTaskSummary, getUpcomingRestWindows, sortTasks, validateTask } from '../src/lib/planning.js';

test('encuentra el próximo bloque de franco', () => {
  assert.deepEqual(getNextRestWindow('2026-01-10', { workDays: 14, restDays: 14, startDate: '2026-01-01' }), {
    startDate: '2026-01-15', endDate: '2026-01-28', days: 14,
  });
});

test('carpeta médica y permiso no cuentan como francos disponibles', () => {
  const config = { workDays: 7, restDays: 7, startDate: '2026-09-01', exceptions: [
    { type: 'medical', startDate: '2026-09-03', endDate: '2026-09-05' },
    { type: 'leave', startDate: '2026-09-08', endDate: '2026-09-10' },
  ] };
  assert.deepEqual(getNextRestWindow('2026-09-03', config), { startDate: '2026-09-11', endDate: '2026-09-14', days: 4 });
  const windows = getUpcomingRestWindows('2026-09-03', config, { limit: 2 });
  assert.deepEqual(windows.map((window) => window.startDate), ['2026-09-11', '2026-09-22']);
});

test('una licencia en medio del franco divide los bloques de tiempo disponible', () => {
  const config = { workDays: 7, restDays: 7, startDate: '2026-09-01', exceptions: [{ type: 'medical', startDate: '2026-09-10', endDate: '2026-09-12' }] };
  assert.deepEqual(getUpcomingRestWindows('2026-09-08', config, { limit: 2 }), [
    { startDate: '2026-09-08', endDate: '2026-09-09', days: 2 },
    { startDate: '2026-09-13', endDate: '2026-09-14', days: 2 },
  ]);
});

test('conserva el franco que llega al límite de búsqueda y señala si continúa', () => {
  const config = { workDays: 7, restDays: 7, startDate: '2026-09-01' };
  assert.deepEqual(getNextRestWindow('2026-09-08', config, 7), { startDate: '2026-09-08', endDate: '2026-09-14', days: 7 });
  assert.deepEqual(getNextRestWindow('2026-09-08', config, 2), { startDate: '2026-09-08', endDate: '2026-09-09', days: 2, continuesBeyondHorizon: true });
  assert.equal(getNextRestWindow('2026-02-30', config), null);
  assert.equal(getNextRestWindow('2026-09-08', config, -1), null);
});

test('las horas del próximo franco no incluyen historia, citas de licencia ni otros ciclos', () => {
  const tasks = [
    { date: '2026-09-02', estimatedMinutes: 600, completed: false },
    { date: '2026-09-05', estimatedMinutes: 120, completed: false },
    { date: '2026-09-08', estimatedMinutes: 60, completed: false },
    { date: '2026-09-10', estimatedMinutes: 30, completed: false },
    { date: '2026-09-11', estimatedMinutes: 240, completed: true },
    { date: '2026-09-22', estimatedMinutes: 500, completed: false },
  ];
  assert.deepEqual(getRestPlanSummary(tasks, { startDate: '2026-09-08', endDate: '2026-09-14' }, '2026-09-03'), { open: 2, completed: 1, overdue: 0, minutesPending: 90 });
  assert.equal(getRestPlanSummary(tasks, null, '2026-09-03').minutesPending, 0);
});

test('permite programar un control durante carpeta médica y preserva id al editar', () => {
  const input = { id: 'control', title: '  Control médico  ', date: '2026-09-05', category: 'health', priority: 'high', estimatedMinutes: '45', completed: false };
  const validation = validateTask(input);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.task, { ...input, title: 'Control médico', estimatedMinutes: 45 });
  assert.equal(validateTask({ ...input, date: '2026-02-30' }).valid, false);
  assert.equal(validateTask({ ...input, estimatedMinutes: Infinity }).valid, false);
  assert.equal(validateTask({ ...input, estimatedMinutes: -1 }).valid, false);
  assert.equal(validateTask({ ...input, title: '   ' }).valid, false);
});

test('resume y ordena tareas del franco', () => {
  const tasks = [
    { id: 'late', title: 'Turno', date: '2026-08-01', priority: 'high', estimatedMinutes: 60, completed: false },
    { id: 'done', title: 'Compra', date: '2026-08-03', priority: 'low', estimatedMinutes: 20, completed: true },
    { id: 'next', title: 'Familia', date: '2026-08-02', priority: 'medium', estimatedMinutes: 90, completed: false },
  ];
  assert.deepEqual(getTaskSummary(tasks, '2026-08-02'), { open: 2, completed: 1, overdue: 1, minutesPending: 150 });
  assert.deepEqual(sortTasks(tasks).map((task) => task.id), ['late', 'next', 'done']);
});
