import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';
import { fetchAccountCensus, summarizeAccountPage } from '../src/lib/accountCensus.js';

const PROJECT = 'rostermax-60242';
const APP = 'roster-max-production';
const DATABASE = `projects/${PROJECT}/databases/(default)/documents`;
const PUBLIC_PARENT = `${DATABASE}/artifacts/${APP}/public/data`;
const SKIP_LOG = { body: true, resBody: true, queryParams: true };
const REQUEST_OPTIONS = { skipLog: SKIP_LOG, resolveOnHTTPError: true };
const DAY = 86400000;

export { summarizeAccountPage as summarizeAuthUsers };

export function buildCensusPublishWrite(census) {
  const countFields = Object.keys(summarizeAccountPage([]));
  const expected = [...countFields, 'schemaVersion', 'source', 'projectId'];
  if (!census || Object.keys(census).length !== expected.length
    || Object.keys(census).some((key) => !expected.includes(key))
    || census.schemaVersion !== 1 || census.source !== 'firebase-auth' || census.projectId !== PROJECT
    || countFields.some((key) => !Number.isSafeInteger(census[key]) || census[key] < 0 || census[key] > 1000000000)
    || census.registeredAccounts + census.guestAccounts !== census.totalAccounts
    || census.googleAccounts > census.registeredAccounts || census.disabledAccounts > census.totalAccounts
    || census.createdLast7Days > census.createdLast30Days || census.createdLast30Days > census.totalAccounts
    || census.signInsLast24Hours > census.signInsLast7Days || census.signInsLast7Days > census.signInsLast30Days
    || census.signInsLast30Days > census.totalAccounts) throw new Error('Invalid census snapshot.');
  return {
    update: {
      name: `${DATABASE}/artifacts/${APP}/admin_stats/accounts`,
      fields: Object.fromEntries(Object.entries(census).map(([key, value]) => [key,
        typeof value === 'number' ? { integerValue: String(value) } : { stringValue: value },
      ])),
    },
    updateTransforms: [{ fieldPath: 'generatedAt', setToServerValue: 'REQUEST_TIME' }],
  };
}

async function clients() {
  const require = createRequire(import.meta.url);
  const { logger } = require('firebase-tools/lib/logger');
  logger.silent = true;
  const auth = require('firebase-tools/lib/auth');
  const { requireAuth } = require('firebase-tools/lib/requireAuth');
  const { Client, getAccessToken } = require('firebase-tools/lib/apiv2');
  const account = auth.getProjectDefaultAccount(resolve(fileURLToPath(new URL('..', import.meta.url))));
  if (!account) throw new Error('Authentication unavailable.');
  const options = { project: PROJECT, projectId: PROJECT, nonInteractive: true };
  auth.setActiveAccount(options, account);
  await requireAuth(options, true);
  return {
    census: async (now) => fetchAccountCensus(await getAccessToken(), { now, timeoutMs: 60000 }),
    firestore: new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1', auth: true }),
    billing: new Client({ urlPrefix: 'https://cloudbilling.googleapis.com', apiVersion: 'v1', auth: true }),
  };
}

function fieldFilter(fieldPath, op, value) {
  return { fieldFilter: { field: { fieldPath }, op, value } };
}

async function count(client, parent, collectionId, where, allDescendants = false) {
  const structuredQuery = { from: [{ collectionId, allDescendants }], ...(where ? { where } : {}) };
  const response = await client.post(`${parent}:runAggregationQuery`, {
    structuredAggregationQuery: { structuredQuery, aggregations: [{ alias: 'total', count: {} }] },
  }, { ...REQUEST_OPTIONS });
  if (response.status !== 200) return {
    available: false, httpStatus: response.status,
    reason: response.body?.error?.message?.includes('index') ? 'missing-index'
      : response.body?.error?.message?.includes('all descendants') ? 'collection-group-query'
        : 'query-unavailable',
  };
  const rows = Array.isArray(response.body) ? response.body : [response.body];
  const raw = rows.find((row) => row.result?.aggregateFields?.total)?.result.aggregateFields.total.integerValue;
  const result = Number(raw);
  return Number.isSafeInteger(result) && result >= 0 ? { available: true, count: result } : { available: false };
}

async function firestoreSummary(client, now) {
  const recent = (days) => ({ compositeFilter: { op: 'AND', filters: [
    fieldFilter('lastActiveAt', 'GREATER_THAN_OR_EQUAL', { timestampValue: new Date(now.getTime() - days * DAY).toISOString() }),
    fieldFilter('lastActiveAt', 'LESS_THAN_OR_EQUAL', { timestampValue: now.toISOString() }),
  ] } });
  const queries = {
    measuredAccounts: [PUBLIC_PARENT, 'activity'],
    measuredGoogleAccounts: [PUBLIC_PARENT, 'activity', fieldFilter('accountType', 'EQUAL', { stringValue: 'google' })],
    measuredInstalls: [PUBLIC_PARENT, 'activity', fieldFilter('installDetected', 'EQUAL', { booleanValue: true })],
    measuredRosterConfigured: [PUBLIC_PARENT, 'activity', fieldFilter('rosterConfigured', 'EQUAL', { booleanValue: true })],
    measuredActive24Hours: [PUBLIC_PARENT, 'activity', recent(1)],
    measuredActive7Days: [PUBLIC_PARENT, 'activity', recent(7)],
    measuredActive30Days: [PUBLIC_PARENT, 'activity', recent(30)],
    publicRosterDocuments: [PUBLIC_PARENT, 'sync_codes'],
    campaignMetricDocuments: [PUBLIC_PARENT, 'campaign_metrics'],
    settingsWithConsent: [`${DATABASE}/artifacts/${APP}`, 'settings', fieldFilter('analyticsEnabled', 'EQUAL', { booleanValue: true }), true],
    settingsWithWorkDays: [`${DATABASE}/artifacts/${APP}`, 'settings', fieldFilter('workDays', 'GREATER_THAN_OR_EQUAL', { integerValue: '1' }), true],
  };
  const results = await Promise.all(Object.entries(queries).map(async ([key, args]) => {
    try { return [key, await count(client, ...args)]; }
    catch { return [key, { available: false }]; }
  }));
  return Object.fromEntries(results);
}

async function billingSummary(client) {
  // Direct GET only: CLI billing helpers can enable APIs as a side effect.
  const response = await client.get(`projects/${PROJECT}/billingInfo`, {
    ...REQUEST_OPTIONS, queryParams: { fields: 'billingEnabled' },
  });
  return response.status === 200
    ? { available: true, billingEnabled: response.body.billingEnabled === true }
    : { available: false, httpStatus: response.status };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    process.stdout.write('Uso: node scripts/diagnose-ceo.mjs [--publish]\nSin --publish sólo lectura. --publish reemplaza exclusivamente el censo agregado privado del CEO. Proyecto fijo rostermax-60242; nunca muestra identidades.\n');
    return;
  }
  if (args.length > 1 || args.some((arg) => arg !== '--publish')) throw new Error('Invalid arguments.');
  const publish = args.includes('--publish');
  const api = await clients();
  const now = new Date();
  const [auth, firestore, billing] = await Promise.all([
    api.census(now).then((snapshot) => ({ available: true, snapshot })).catch((error) => ({ available: false, reason: typeof error?.code === 'string' && error.code.startsWith('census/') ? error.code : 'auth-unavailable' })),
    firestoreSummary(api.firestore, now).catch(() => ({ available: false })),
    billingSummary(api.billing).catch(() => ({ available: false })),
  ]);
  let published = false;
  if (publish && auth.available) {
    const result = await api.firestore.post(`${DATABASE}:commit`, { writes: [buildCensusPublishWrite(auth.snapshot)] }, { ...REQUEST_OPTIONS });
    published = result.status >= 200 && result.status < 300;
    if (!published) process.exitCode = 2;
  }
  process.stdout.write(`${JSON.stringify({ checkedAt: now.toISOString(), auth, firestore, billing, publishRequested: publish, published }, null, 2)}\n`);
  if (!auth.available) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    process.stderr.write('No se pudo completar el diagnóstico de sólo lectura. Comprueba la sesión y permisos de Firebase.\n');
    process.exitCode = 1;
  });
}
