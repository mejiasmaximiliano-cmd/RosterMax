import { parseDateOnly } from './roster.js';

export const COMPENSATORY_DIRECTIONS = { company_owes: 'La empresa me debe', worker_owes: 'Yo debo a la empresa' };
export const COMPENSATORY_KINDS = {
  open: 'Deuda registrada', edit: 'Deuda corregida', settle: 'Compensación registrada',
  edit_settlement: 'Compensación corregida', void_settlement: 'Compensación anulada', void: 'Deuda anulada',
};
const MAX_UNITS = 20000;
const validId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);

export function daysToUnits(value) {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!/^\d+(?:\.0|\.5)?$/.test(text)) throw new Error('Usa días enteros o medios días: 0,5; 1; 1,5…');
  const units = Number(text) * 2;
  if (!Number.isSafeInteger(units) || units < 1 || units > MAX_UNITS) throw new Error('La cantidad debe estar entre 0,5 y 10.000 días.');
  return units;
}

export function formatCompensatoryDays(units) {
  return Number.isSafeInteger(units) && units >= 0 ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(units / 2) : '—';
}

export function compensatoryBalances(debts) {
  const balances = { company_owes: 0, worker_owes: 0 };
  for (const debt of debts || []) {
    if (debt.voided || !Object.hasOwn(balances, debt.direction)) continue;
    if (!Number.isSafeInteger(debt.totalUnits) || !Number.isSafeInteger(debt.settledUnits) || debt.settledUnits < 0 || debt.totalUnits < debt.settledUnits) continue;
    balances[debt.direction] += debt.totalUnits - debt.settledUnits;
  }
  return balances;
}

/** Only this private ledger changes. It has no calendar/finance side effects. */
export function buildCompensatoryChange({ id, debtId, debt, kind, quantity, informativeDate, note = '', direction, referenceId = '' }) {
  if (!validId(id) || !validId(debtId) || !Object.hasOwn(COMPENSATORY_KINDS, kind)) throw new Error('El movimiento no es válido.');
  if (parseDateOnly(informativeDate) === null) throw new Error('Elige una fecha informativa válida.');
  if (typeof note !== 'string' || note.length > 500) throw new Error('La observación admite hasta 500 caracteres.');
  const units = ['void', 'void_settlement'].includes(kind) ? 0 : daysToUnits(quantity);
  let head;
  let previousUnits = 0;
  if (kind === 'open') {
    if (debt || !Object.hasOwn(COMPENSATORY_DIRECTIONS, direction)) throw new Error('Selecciona quién debe esos días.');
    head = { schemaVersion: 1, direction, totalUnits: units, settledUnits: 0, settlements: {}, voided: false, informativeDate, note: note.trim(), revision: 1, lastEventId: id };
  } else {
    if (!debt || debt.voided || !Number.isSafeInteger(debt.revision)) throw new Error('Esta deuda ya no está disponible para modificar.');
    head = { schemaVersion: 1, direction: debt.direction, totalUnits: debt.totalUnits, settledUnits: debt.settledUnits, settlements: { ...debt.settlements }, voided: false, informativeDate: debt.informativeDate, note: debt.note, revision: debt.revision + 1, lastEventId: id };
    if (kind === 'edit') {
      if (units < head.settledUnits) throw new Error('La deuda corregida no puede ser menor que los días ya compensados.');
      previousUnits = head.totalUnits;
      Object.assign(head, { totalUnits: units, informativeDate, note: note.trim() });
    } else if (kind === 'void') {
      if (head.settledUnits !== 0 || Object.keys(head.settlements).length) throw new Error('Anula primero las compensaciones de esta deuda para conservar un historial coherente.');
      previousUnits = head.totalUnits;
      head.voided = true;
    } else if (kind === 'settle') {
      if (Object.keys(head.settlements).length >= 200) throw new Error('Esta deuda ya tiene 200 compensaciones. Revisa sus registros antes de agregar otra.');
      referenceId = id;
      head.settlements[id] = units;
      head.settledUnits += units;
    } else {
      if (!validId(referenceId) || !Number.isSafeInteger(head.settlements[referenceId]) || head.settlements[referenceId] < 1) throw new Error('La compensación ya fue anulada o cambió. Actualiza el historial.');
      previousUnits = head.settlements[referenceId];
      head.settledUnits += units - previousUnits;
      if (kind === 'void_settlement') delete head.settlements[referenceId];
      else head.settlements[referenceId] = units;
    }
    if (head.settledUnits > head.totalUnits || head.settledUnits < 0) throw new Error('No puedes compensar más días de los que quedan pendientes.');
  }
  const event = { schemaVersion: 1, debtId, kind, units, previousUnits, referenceId, informativeDate, note: note.trim(), revision: head.revision };
  return { head, event };
}
