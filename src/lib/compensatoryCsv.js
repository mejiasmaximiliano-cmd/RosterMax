import { COMPENSATORY_DIRECTIONS, COMPENSATORY_KINDS, compensatoryBalances } from './compensatories.js';
import { parseDateOnly } from './roster.js';

export function localInformativeDate(value) {
  const time = parseDateOnly(value);
  return time === null ? 'Sin fecha' : new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(time));
}

export function debtStatus(debt) {
  return debt.voided ? 'voided' : debt.totalUnits === debt.settledUnits ? 'settled' : 'pending';
}

// Quote every field; neutralize spreadsheet formulas even after leading whitespace.
function cell(value) {
  const text = String(value ?? '');
  const safe = /^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
const days = (units) => String(units / 2).replace('.', ',');
const syncLabel = (row, confirmed) => row.pending ? 'Pendiente de sincronizar' : confirmed ? 'Sincronizado' : 'Guardado en el dispositivo';

export function buildCompensatoryCsv({ debts, entries, confirmed = false }) {
  const balances = compensatoryBalances(debts);
  const rows = [['Clase de fila', 'ID deuda', 'ID movimiento', 'Dirección del saldo', 'Fecha informativa', 'Tipo / estado', 'Días registrados', 'Días compensados', 'Días pendientes computables', 'Cantidad del movimiento (no sumar al saldo)', 'Cantidad anterior', 'Revisión', 'Referencia', 'Sincronización', 'Observación']];
  for (const direction of Object.keys(COMPENSATORY_DIRECTIONS)) rows.push(['SALDO', '', '', COMPENSATORY_DIRECTIONS[direction], '', 'Resumen; no sumar a deudas', '', '', days(balances[direction])]);
  for (const debt of [...debts].sort((a, b) => a.informativeDate.localeCompare(b.informativeDate) || a.id.localeCompare(b.id))) {
    rows.push(['DEUDA', debt.id, '', COMPENSATORY_DIRECTIONS[debt.direction], localInformativeDate(debt.informativeDate), ({ pending: 'Pendiente', settled: 'Saldada', voided: 'Anulada' })[debtStatus(debt)], days(debt.totalUnits), days(debt.settledUnits), days(debt.voided ? 0 : debt.totalUnits - debt.settledUnits), '', '', debt.revision, '', syncLabel(debt, confirmed), debt.note]);
    for (const entry of entries.filter((row) => row.debtId === debt.id).sort((a, b) => a.revision - b.revision)) rows.push(['MOVIMIENTO (historial; no sumar)', debt.id, entry.id, COMPENSATORY_DIRECTIONS[debt.direction], localInformativeDate(entry.informativeDate), COMPENSATORY_KINDS[entry.kind], '', '', '', days(entry.units), days(entry.previousUnits || 0), entry.revision, entry.referenceId || '', syncLabel(entry, confirmed), entry.note]);
  }
  return '\uFEFF' + rows.map((row) => Array.from({ length: 15 }, (_, i) => cell(row[i])).join(';')).join('\r\n') + '\r\n';
}
