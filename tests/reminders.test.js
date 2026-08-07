import test from 'node:test';
import assert from 'node:assert/strict';
import { getTransitionReminder } from '../src/lib/reminders.js';

const config = { workDays: 14, restDays: 14, startDate: '2026-01-01' };

test('crea un recordatorio cuando la bajada está dentro del aviso', () => {
  const reminder = getTransitionReminder('2026-01-13', config, 2);
  assert.equal(reminder.date, '2026-01-15');
  assert.match(reminder.title, /franco/);
});

test('no crea recordatorio antes de la ventana elegida', () => {
  assert.equal(getTransitionReminder('2026-01-10', config, 2), null);
});
