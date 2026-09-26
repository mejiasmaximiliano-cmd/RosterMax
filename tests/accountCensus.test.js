import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAccountCensus, summarizeAccountPage } from '../src/lib/accountCensus.js';

const now = new Date('2026-09-25T12:00:00Z');
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });

test('censo completo pagina con máscara mínima y nunca devuelve identidades ni token', async () => {
  let page = 0;
  const result = await fetchAccountCensus('temporary-test-token', { now, fetchImpl: async (rawUrl, options) => {
    const url = new URL(rawUrl);
    assert.equal(url.origin, 'https://identitytoolkit.googleapis.com');
    assert.equal(url.pathname, '/v1/projects/rostermax-60242/accounts:batchGet');
    assert.ok(!url.searchParams.get('fields').match(/email,|localId|displayName|passwordHash/));
    assert.equal(options.headers.Authorization, 'Bearer temporary-test-token');
    assert.equal(options.cache, 'no-store');
    if (page++ === 0) return response({ users: [{ providerUserInfo: [{ providerId: 'google.com' }] }], nextPageToken: 'second' });
    assert.equal(url.searchParams.get('nextPageToken'), 'second');
    return response({ users: [{}, { customAuth: true, disabled: true }] });
  } });
  assert.equal(page, 2);
  assert.equal(result.totalAccounts, 3);
  assert.equal(result.registeredAccounts, 2);
  assert.equal(result.guestAccounts, 1);
  assert.equal(result.googleAccounts, 1);
  assert.equal(result.disabledAccounts, 1);
  assert.ok(!JSON.stringify(result).includes('temporary-test-token'));
});

test('fallos, permisos, límite y paginación repetida rechazan el censo entero', async () => {
  for (const [failure, code] of [
    [() => response({}, 403), 'census/permission-denied'],
    [() => response({}, 401), 'census/expired-token'],
    [() => response({ users: {} }), 'census/invalid-response'],
    [() => { throw new Error('sensitive upstream data'); }, 'census/network-error'],
  ]) {
    let call = 0;
    await assert.rejects(fetchAccountCensus('test', { now, fetchImpl: async () => call++ === 0
      ? response({ users: [{}], nextPageToken: 'second' }) : failure() }), { code });
  }
  await assert.rejects(fetchAccountCensus('test', { now, maxPages: 1, fetchImpl: async () => response({ users: [{}], nextPageToken: 'more' }) }), { code: 'census/page-limit' });
  await assert.rejects(fetchAccountCensus('test', { now, fetchImpl: async () => response({ users: [{}], nextPageToken: 'same' }) }), { code: 'census/repeated-page' });
});

test('una petición lenta cancela sin producir un snapshot parcial', async () => {
  await assert.rejects(fetchAccountCensus('test', { now, timeoutMs: 10, fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }) }), { code: 'census/timeout' });
});

test('las fechas de login se cuentan como autenticación y excluyen valores futuros o corruptos', () => {
  const result = summarizeAccountPage([
    { lastLoginAt: String(now.getTime()), createdAt: String(now.getTime()) },
    { lastLoginAt: String(now.getTime() - 7 * 86400000), providerUserInfo: [{ providerId: 'google.com' }] },
    { lastLoginAt: String(now.getTime() + 1), createdAt: 'invalid' },
  ], now);
  assert.equal(result.signInsLast24Hours, 1);
  assert.equal(result.signInsLast7Days, 2);
  assert.equal(result.signInsLast30Days, 2);
  assert.equal(result.createdLast7Days, 1);
});
