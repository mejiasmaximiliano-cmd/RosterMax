/**
 * Public availability wire format, version 1. Private exception objects never
 * leave a user's document tree. Fixed tokens keep every one of the 30 items
 * strictly verifiable within Firestore's per-request expression limit.
 *
 * N|start|end = unavailable (no reason); R|start|end = rest; W|start|end = work.
 * C|start|end|workDays|restDays|cycleStart = temporary alternative cycle.
 */
const TYPES = {
  unavailable: { token: 'N', mode: 'rest' },
  rest_override: { token: 'R', mode: 'rest' },
  extra_work: { token: 'W', mode: 'work' },
  special_roster: { token: 'C', mode: 'cycle' },
};
const TOKEN_TYPES = Object.fromEntries(Object.entries(TYPES).map(([type, { token }]) => [token, type]));

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validCycleLength(value) {
  return Number.isInteger(value) && value >= 1 && value <= 365;
}

export function encodeSharedExceptions(exceptions) {
  if (!Array.isArray(exceptions) || exceptions.length > 30) {
    throw new Error('Puedes compartir hasta 30 cambios temporales. No se omitió ningún cambio.');
  }
  return exceptions.map((item) => {
    const definition = Object.hasOwn(TYPES, item?.type) ? TYPES[item.type] : null;
    if (!definition || item.mode !== definition.mode || !validDate(item.startDate)
      || !validDate(item.endDate) || item.startDate > item.endDate) {
      throw new Error('La disponibilidad compartida contiene un cambio inválido.');
    }
    const fields = [definition.token, item.startDate, item.endDate];
    if (definition.mode === 'cycle') {
      if (!validCycleLength(item.workDays) || !validCycleLength(item.restDays) || !validDate(item.cycleStartDate)) {
        throw new Error('El ciclo temporal compartido no es válido.');
      }
      fields.push(item.workDays, item.restDays, item.cycleStartDate);
    }
    return fields.join('|');
  });
}

export function decodeSharedExceptions(encoded) {
  if (!Array.isArray(encoded) || encoded.length > 30) return [];
  return encoded.flatMap((value) => {
    if (typeof value !== 'string' || value.length > 60) return [];
    const [token, startDate, endDate, rawWork, rawRest, cycleStartDate, ...extra] = value.split('|');
    const type = Object.hasOwn(TOKEN_TYPES, token) ? TOKEN_TYPES[token] : null;
    if (!type || extra.length || !validDate(startDate) || !validDate(endDate) || startDate > endDate) return [];
    const item = { type, mode: TYPES[type].mode, startDate, endDate };
    if (type === 'special_roster') {
      if (!/^[1-9]\d{0,2}$/.test(rawWork || '') || !/^[1-9]\d{0,2}$/.test(rawRest || '')
        || !validCycleLength(Number(rawWork)) || !validCycleLength(Number(rawRest)) || !validDate(cycleStartDate)) return [];
      Object.assign(item, { workDays: Number(rawWork), restDays: Number(rawRest), cycleStartDate });
    } else if (rawWork !== undefined) return [];
    return [item];
  });
}
