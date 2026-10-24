export const FEATURE_TYPES = {
  roster_configured: 'Configuración de roster', invitation_accepted: 'Invitaciones aceptadas',
  plan_saved: 'Planes guardados', expense_recorded: 'Gastos registrados',
  goal_created: 'Metas creadas', compensatory_recorded: 'Movimientos compensatorios',
};
export function summarizeFeatureEvents(events, { now = new Date(), days = 30, excludedUids = [] } = {}) {
  const totals = Object.fromEntries(Object.keys(FEATURE_TYPES).map((type) => [type, 0]));
  const seen = new Set(), accounts = new Set();
  let since = null, excluded = 0, invalid = 0;
  for (const event of events || []) {
    const ms = event.occurredAt?.seconds * 1000;
    if (!event.id || seen.has(event.id)) continue;
    seen.add(event.id);
    if (!Object.hasOwn(totals, event.type) || !Number.isFinite(ms) || ms <= 0 || ms > now.getTime()) { invalid++; continue; }
    if (since === null || ms < since) since = ms;
    if (excludedUids.includes(event.ownerUid)) { excluded++; continue; }
    if (now.getTime() - ms > days * 86400000) continue;
    totals[event.type]++; accounts.add(event.ownerUid);
  }
  return { totals, accounts: accounts.size, since, excluded, invalid };
}
