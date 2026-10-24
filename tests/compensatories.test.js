import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompensatoryChange, compensatoryBalances, daysToUnits } from '../src/lib/compensatories.js';
import { getStatusForDate, getNextTransition, sanitizeSharedExceptions } from '../src/lib/roster.js';
import { buildMonthCalendar, createRosterIcs } from '../src/lib/calendar.js';
import { findRestCoincidences } from '../src/lib/coincidences.js';
import { getMonthlyBudgetSummary } from '../src/lib/finance.js';
import { getTransitionReminder } from '../src/lib/reminders.js';

const day = '2026-10-24';
const change = (input) => buildCompensatoryChange({ informativeDate: day, ...input });
test('balances remain separate and settle the mandatory 3→2 and 2→1.5 examples exactly', () => {
  let company = change({ id: 'open-c', debtId: 'c', kind: 'open', direction: 'company_owes', quantity: '3' }).head;
  let worker = change({ id: 'open-w', debtId: 'w', kind: 'open', direction: 'worker_owes', quantity: '2' }).head;
  company = change({ id: 'settle-c', debtId: 'c', debt: company, kind: 'settle', quantity: '1' }).head;
  worker = change({ id: 'settle-w', debtId: 'w', debt: worker, kind: 'settle', quantity: '0.5' }).head;
  assert.deepEqual(compensatoryBalances([company, worker]), { company_owes: 4, worker_owes: 3 });
  assert.throws(() => change({ id: 'extra', debtId: 'w', debt: worker, kind: 'settle', quantity: '2' }), /más días/);
});
test('exact half-day validation rejects hours, quarters, infinity and negative values', () => {
  assert.equal(daysToUnits('1,5'), 3);
  for (const value of ['0', '-1', '0.25', '1.1', '', '8 horas', Infinity]) assert.throws(() => daysToUnits(value));
});
test('corrections and cancellations keep immutable history and reference the settlement being reversed', () => {
  const opened = change({ id: 'a', debtId: 'd', kind: 'open', direction: 'company_owes', quantity: 3 });
  const settled = change({ id: 'b', debtId: 'd', debt: opened.head, kind: 'settle', quantity: 1 });
  const edited = change({ id: 'c', debtId: 'd', debt: settled.head, kind: 'edit_settlement', referenceId: 'b', quantity: '0.5' });
  assert.equal(edited.head.settledUnits, 1); assert.equal(edited.event.previousUnits, 2); assert.equal(edited.event.referenceId, 'b');
  assert.throws(() => change({ id: 'bad', debtId: 'd', debt: edited.head, kind: 'void' }), /Anula primero/);
  const reversed = change({ id: 'e', debtId: 'd', debt: edited.head, kind: 'void_settlement', referenceId: 'b' });
  const cancelled = change({ id: 'f', debtId: 'd', debt: reversed.head, kind: 'void' });
  assert.equal(cancelled.head.voided, true); assert.equal(cancelled.head.revision, 5);
  assert.equal(opened.head.totalUnits, 6); assert.equal(settled.event.units, 2);
  assert.throws(() => change({ id: 'g', debtId: 'd', debt: cancelled.head, kind: 'settle', quantity: 1 }));
});
test('ALL calendar results and derived features are identical before and after compensatory operations', () => {
  const roster = { workDays: 14, restDays: 7, startDate: '2024-02-22', exceptions: [{ type: 'medical', mode: 'rest', startDate: '2024-02-27', endDate: '2024-03-02' }] };
  const serialized = JSON.stringify(roster);
  const derive = () => ({
    // Every date in a leap-year-spanning two-year window, not only today.
    days: Array.from({ length: 732 }, (_, offset) => getStatusForDate(new Date(Date.UTC(2023, 11, 1 + offset)).toISOString().slice(0, 10), roster)),
    months: Array.from({ length: 24 }, (_, offset) => buildMonthCalendar(new Date(Date.UTC(2024, offset, 1)).toISOString().slice(0, 7), roster, [])),
    transition: getNextTransition(day, roster), reminder: getTransitionReminder(day, roster),
    shared: sanitizeSharedExceptions(roster.exceptions), ics: createRosterIcs({ config: roster, startDate: '2024-02-01', days: 90, generatedAt: new Date('2026-10-24T12:00:00Z') }),
    coincidences: findRestCoincidences(day, roster, [{ id: 'colleague', ...roster }]),
    budget: getMonthlyBudgetSummary({ monthlyIncome: 1000, currency: 'ARS' }, [], roster, '2026-10', day),
  });
  const before = derive();
  let head = change({ id: 'new', debtId: 'debt', kind: 'open', direction: 'company_owes', quantity: 3 }).head;
  head = change({ id: 'partial', debtId: 'debt', debt: head, kind: 'settle', quantity: 1 }).head;
  head = change({ id: 'correction', debtId: 'debt', debt: head, kind: 'edit', quantity: 4 }).head;
  head = change({ id: 'reverse', debtId: 'debt', debt: head, kind: 'void_settlement', referenceId: 'partial' }).head;
  change({ id: 'void', debtId: 'debt', debt: head, kind: 'void' });
  assert.deepEqual(derive(), before); assert.equal(JSON.stringify(roster), serialized);
});
