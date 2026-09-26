import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeAuthUsers, buildCensusPublishWrite } from '../scripts/diagnose-ceo.mjs';

test('distingue cuentas vinculadas e invitados sin equiparar login con actividad', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  const ms = now.getTime();
  assert.deepEqual(summarizeAuthUsers([
    { providerUserInfo: [{ providerId: 'google.com' }], lastLoginAt: String(ms - 1000), createdAt: String(ms - 1000) },
    { providerUserInfo: [], lastLoginAt: String(ms - 2 * 86400000) },
    { providerUserInfo: [{ providerId: 'password' }], disabled: true, lastLoginAt: String(ms - 8 * 86400000) },
    { customAuth: true, lastLoginAt: String(ms + 1000) },
  ], now), {
    totalAccounts: 4, registeredAccounts: 3, guestAccounts: 1, disabledAccounts: 1, googleAccounts: 1,
    signInsLast24Hours: 1, signInsLast7Days: 2, signInsLast30Days: 3, createdLast7Days: 1, createdLast30Days: 1,
  });
});

test('publicación administrativa escribe sólo agregados validados en destino CEO fijo', () => {
  const snapshot = { schemaVersion: 1, source: 'firebase-auth', projectId: 'rostermax-60242', ...summarizeAuthUsers([{}, {}]) };
  const write = buildCensusPublishWrite(snapshot);
  assert.equal(write.update.name, 'projects/rostermax-60242/databases/(default)/documents/artifacts/roster-max-production/admin_stats/accounts');
  assert.deepEqual(write.updateTransforms, [{ fieldPath: 'generatedAt', setToServerValue: 'REQUEST_TIME' }]);
  assert.deepEqual(write.update.fields.totalAccounts, { integerValue: '2' });
  for (const invalid of [
    { ...snapshot, emails: ['should-not-be-saved'] }, { ...snapshot, totalAccounts: 0 },
    { ...snapshot, totalAccounts: -1 }, { ...snapshot, projectId: 'another-project' },
  ]) assert.throws(() => buildCensusPublishWrite(invalid));
});
