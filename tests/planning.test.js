import test from 'node:test';
import assert from 'node:assert/strict';
import { getNextRestWindow, getTaskSummary, sortTasks } from '../src/lib/planning.js';

test('encuentra el próximo bloque de franco', () => {
  assert.deepEqual(getNextRestWindow('2026-01-10', { workDays: 14, restDays: 14, startDate: '2026-01-01' }), {
    startDate: '2026-01-15', endDate: '2026-01-28', days: 14,
  });
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
