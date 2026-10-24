import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { resolve } from 'node:path';

// READ ONLY, fixed production project. Aggregate status counts and rule source
// fingerprint only; never returns tokens, identifiers, messages or private data.
const project = 'rostermax-60242', namespace = 'roster-max-production';
const require = createRequire(import.meta.url);
require('firebase-tools/lib/logger').logger.silent = true;
const auth = require('firebase-tools/lib/auth');
const { requireAuth } = require('firebase-tools/lib/requireAuth');
const { Client } = require('firebase-tools/lib/apiv2');
const account = auth.getProjectDefaultAccount(resolve('.'));
const options = { project, projectId: project, nonInteractive: true };
const skipLog = { body: true, resBody: true, queryParams: true };
const request = { skipLog, resolveOnHTTPError: true };
try {
  if (!account) throw new Error('No CLI account');
  auth.setActiveAccount(options, account); await requireAuth(options, true);
  const rules = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1', auth: true });
  const release = await rules.get(`projects/${project}/releases/cloud.firestore`, request);
  if (release.status !== 200) throw new Error('Rules unavailable');
  const source = await rules.get(release.body.rulesetName, request);
  if (source.status !== 200) throw new Error('Rules source unavailable');
  const normalize = (value) => value.replaceAll('\r\n', '\n').trim();
  const hash = (value) => createHash('sha256').update(normalize(value)).digest('hex');
  const local = hash(readFileSync('firestore.rules', 'utf8'));
  const deployed = source.body.source.files.find((file) => file.name.endsWith('.rules'))?.content;
  const firestore = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1', auth: true });
  const parent = `projects/${project}/databases/(default)/documents/artifacts/${namespace}/public/data`;
  const counts = {};
  for (const status of ['all', 'new', 'in_progress', 'resolved']) {
    const response = await firestore.post(`${parent}:runAggregationQuery`, { structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'feedback' }], ...(status === 'all' ? {} : { where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: status } } } }) }, aggregations: [{ alias: 'total', count: {} }] } }, request);
    const rows = Array.isArray(response.body) ? response.body : [response.body];
    counts[status] = response.status === 200 ? Number(rows.find((row) => row.result)?.result.aggregateFields.total.integerValue) : null;
  }
  process.stdout.write(JSON.stringify({ checkedAt: new Date().toISOString(), project, namespace, readOnly: true, rules: { release: release.body.name, ruleset: release.body.rulesetName, updatedAt: release.body.updateTime, sha256: deployed ? hash(deployed) : null, matchesLocal: deployed ? hash(deployed) === local : false }, feedbackCounts: counts }, null, 2) + '\n');
} catch { process.stderr.write('No se pudo verificar el estado agregado de producción con las credenciales actuales.\n'); process.exitCode = 1; }
