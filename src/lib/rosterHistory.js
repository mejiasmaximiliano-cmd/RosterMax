// Date-only strings are ordered lexically. No compensatory data enters here.
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s) => typeof s === 'string' && datePattern.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
const cycle = (c) => ({ workDays: Number(c.workDays), restDays: Number(c.restDays), startDate: c.startDate });
const validCycle = (c) => [c.workDays, c.restDays].every((n) => Number.isInteger(n) && n >= 1 && n <= 365) && validDate(c.startDate);

export function decodeRosterHistory(wire) {
  if (typeof wire !== 'string' || wire.length > 2000) return null;
  const rows = wire.split(';');
  if (rows.length > 21) return null;
  const [token, w, r, start, ...extra] = rows.shift().split('|');
  const base = { workDays: Number(w), restDays: Number(r), startDate: start, periods: [] };
  if (token !== 'B' || extra.length || !validCycle(base)) return null;
  for (const row of rows) {
    const [type, effectiveDate, workDays, restDays, startDate, ...rest] = row.split('|');
    const period = { effectiveDate, workDays: Number(workDays), restDays: Number(restDays), startDate };
    if (type !== 'P' || rest.length || !validDate(effectiveDate) || !validCycle(period) || (base.periods.at(-1)?.effectiveDate >= effectiveDate)) return null;
    base.periods.push(period);
  }
  return base;
}

export function rosterForDate(config, date) {
  const source = config?.history ? decodeRosterHistory(config.history) : config;
  if (!source) return {};
  const periods = Array.isArray(source.periods) ? source.periods : [];
  const active = periods.filter((p) => p.effectiveDate <= date).sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))[0];
  return active || source;
}

export function encodeRosterHistory(config) {
  const base = cycle(config);
  if (!validCycle(base)) throw new Error('El historial no tiene un diagrama base válido.');
  const periods = [...(config.periods || [])].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
  const wire = [`B|${base.workDays}|${base.restDays}|${base.startDate}`, ...periods.map((p) => `P|${p.effectiveDate}|${p.workDays}|${p.restDays}|${p.startDate}`)].join(';');
  if (!decodeRosterHistory(wire)) throw new Error('Revisa las vigencias; se admiten hasta 20, sin fechas repetidas.');
  return wire;
}

export function changeRosterConfiguration(current, input, { mode = 'correction', effectiveDate } = {}) {
  const next = cycle(input);
  if (!validCycle(next)) throw new Error('Revisa el diagrama y su inicio de ciclo.');
  if (!validCycle(cycle(current || {}))) return next;
  const periods = [...(current.periods || [])].map((p) => ({ ...p }));
  if (mode === 'change') {
    if (!validDate(effectiveDate)) throw new Error('Elige desde cuándo cambia tu diagrama.');
    if (periods.some((p) => p.effectiveDate === effectiveDate)) throw new Error('Ya existe una vigencia en esa fecha. Usa una corrección para modificarla.');
    periods.push({ ...next, effectiveDate });
  } else if (mode === 'correction') {
    if (!validDate(effectiveDate)) throw new Error('Selecciona la fecha de la configuración que deseas corregir.');
    const active = rosterForDate(current, effectiveDate);
    if (active.effectiveDate) Object.assign(periods.find((p) => p.effectiveDate === active.effectiveDate), next);
    else return { ...current, ...next, periods };
  } else throw new Error('Elige corrección o cambio permanente.');
  const result = { ...current, periods: periods.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate)) };
  encodeRosterHistory(result);
  return result;
}
