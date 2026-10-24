import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompensatoryCsv, debtStatus, localInformativeDate } from '../src/lib/compensatoryCsv.js';
import { buildCompensatoryChange, compensatoryBalances } from '../src/lib/compensatories.js';
import { describeRestWindow } from '../src/lib/planning.js';
import { getStatusForDate, getNextTransition, addDaysToDate } from '../src/lib/roster.js';
import { changeRosterConfiguration } from '../src/lib/rosterHistory.js';

function parseCsv(csv) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 1; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') { if (quoted && csv[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
    else if (c === ';' && !quoted) { row.push(field); field = ''; }
    else if (c === '\r' && csv[i + 1] === '\n' && !quoted) { row.push(field); rows.push(row); field = ''; row = []; i++; }
    else field += c;
  }
  return rows;
}
const date = '2026-10-24';
const change = (input) => buildCompensatoryChange({ informativeDate: date, ...input });

test('owner representative 14×14: Oct 24 is rest 10/14, full Oct 15–28, next work Oct 29; future vigency and ledger preserve ALL prior dates', () => {
  const base = { workDays: 14, restDays: 14, startDate: '2026-10-01' };
  const status = getStatusForDate(date, base);
  assert.equal(status.isWorking, false); assert.equal(status.actualDay, 10); assert.equal(status.totalPhaseDays, 14);
  const rest = describeRestWindow(date, base);
  assert.equal(rest.fullStart, '2026-10-15'); assert.equal(rest.endDate, '2026-10-28'); assert.equal(rest.fullDays, 14); assert.equal(rest.remainingDays, 5); assert.equal(rest.includesToday, true);
  assert.equal(getNextTransition(date, base).date, '2026-10-29');
  const updated = changeRosterConfiguration(base, { workDays: 7, restDays: 7, startDate: '2026-11-01' }, { mode: 'change', effectiveDate: '2026-11-01' });
  for (let i = 0; i < 732; i++) { const day = addDaysToDate('2024-10-30', i); assert.deepEqual(getStatusForDate(day, updated), getStatusForDate(day, base)); }
  const serialized = JSON.stringify(updated);
  const before = Array.from({ length: 1096 }, (_, i) => getStatusForDate(addDaysToDate('2025-01-01', i), updated));
  const opened = change({ id: 'open', debtId: 'd', kind: 'open', direction: 'company_owes', quantity: 3 });
  change({ id: 'settle', debtId: 'd', kind: 'settle', debt: opened.head, quantity: 1 });
  assert.equal(JSON.stringify(updated), serialized);
  assert.deepEqual(Array.from({ length: 1096 }, (_, i) => getStatusForDate(addDaysToDate('2025-01-01', i), updated)), before);
  assert.equal(describeRestWindow(date, updated).fullStart, '2026-10-15'); assert.equal(getNextTransition(date, updated).date, '2026-10-29');
});

test('CSV balances match UI exactly; revisions and cancellations do not duplicate balances; user text is escaped', () => {
  const entries = []; const save = (id, input) => { const result = change({ id, ...input }); entries.push({ ...result.event, id }); return { ...result.head, id: input.debtId }; };
  let company = save('c1', { debtId: 'company', kind: 'open', direction: 'company_owes', quantity: 3, note: '=HYPERLINK("evil");texto\nsegunda línea' });
  company = save('c2', { debtId: 'company', kind: 'settle', debt: company, quantity: 1 });
  let worker = save('w1', { debtId: 'worker', kind: 'open', direction: 'worker_owes', quantity: 2, note: '  @SUM(1)' });
  worker = save('w2', { debtId: 'worker', kind: 'settle', debt: worker, quantity: 0.5 });
  let cancelled = save('v1', { debtId: 'cancelled', kind: 'open', direction: 'company_owes', quantity: 8 });
  cancelled = save('v2', { debtId: 'cancelled', kind: 'edit', debt: cancelled, quantity: 9, note: '+formula' });
  cancelled = save('v3', { debtId: 'cancelled', kind: 'void', debt: cancelled, note: 'Anulada' });
  const debts = [company, worker, cancelled];
  const csv = buildCompensatoryCsv({ debts, entries, confirmed: true });
  const rows = parseCsv(csv);
  assert.ok(rows.every((row) => row.length === 15));
  assert.equal(rows.filter((row) => row[0] === 'DEUDA').length, 3);
  assert.equal(rows.filter((row) => row[0].startsWith('MOVIMIENTO')).length, 7);
  const balances = compensatoryBalances(debts);
  for (const [direction, label] of [['company_owes', 'La empresa me debe'], ['worker_owes', 'Yo debo a la empresa']]) {
    const sum = rows.filter((row) => row[0] === 'DEUDA' && row[3] === label).reduce((total, row) => total + Number(row[8].replace(',', '.')) * 2, 0);
    assert.equal(sum, balances[direction]);
  }
  assert.equal(debtStatus(cancelled), 'voided');
  assert.equal(localInformativeDate(date), '24/10/2026');
  assert.equal(rows.find((row) => row[2] === 'c1')[14], '\'=HYPERLINK("evil");texto\nsegunda línea');
  assert.equal(rows.find((row) => row[2] === 'w1')[14], "'@SUM(1)"); // model trims notes at entry
  const raw = buildCompensatoryCsv({ debts: [{ ...worker, note: '  @SUM(1)' }], entries: [] });
  assert.equal(parseCsv(raw).find((row) => row[0] === 'DEUDA')[14], "'  @SUM(1)");
  assert.equal(rows.find((row) => row[2] === 'v2')[14], "'+formula");
  assert.match(csv, /Sincronizado/);
  assert.match(buildCompensatoryCsv({ debts: [{ ...company, pending: true }], entries }), /Pendiente de sincronizar/);
});
