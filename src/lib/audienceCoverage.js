export function filterMeasuredAccounts(rows, excludedUids = []) {
  if (!Array.isArray(rows)) return { before: null, excluded: null, included: null, rows: null };
  const excluded = new Set(excludedUids);
  const accounts = new Map();
  for (const row of rows) if (row && typeof row.ownerUid === 'string') accounts.set(row.ownerUid, row);
  const includedRows = [...accounts.values()].filter((row) => !excluded.has(row.ownerUid));
  return { before: accounts.size, excluded: accounts.size - includedRows.length, included: includedRows.length, rows: includedRows };
}
