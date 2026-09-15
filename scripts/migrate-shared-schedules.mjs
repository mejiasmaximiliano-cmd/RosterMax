import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';
import { decodeSharedExceptions, encodeSharedExceptions } from '../src/lib/sharedSchedule.js';

const PROJECT = 'rostermax-60242';
const APP = 'roster-max-production';
const DATABASE_PATH = `projects/${PROJECT}/databases/(default)/documents`;
const COLLECTION_PATH = `${DATABASE_PATH}/artifacts/${APP}/public/data/sync_codes`;
const SKIP_LOG = { body: true, resBody: true, queryParams: true };

const LEGACY_TYPES = {
  medical: ['unavailable', 'rest'], leave: ['unavailable', 'rest'],
  vacation: ['rest_override', 'rest'], unavailable: ['unavailable', 'rest'],
  rest_override: ['rest_override', 'rest'], extra_work: ['extra_work', 'work'],
  special_roster: ['special_roster', 'cycle'],
};

function decodeLegacyMap(value) {
  const fields = value?.mapValue?.fields;
  const legacyType = fields?.type?.stringValue;
  if (!fields || !Object.hasOwn(LEGACY_TYPES, legacyType)) throw new Error('Invalid legacy map.');
  const [type, mode] = LEGACY_TYPES[legacyType];
  if (fields.mode && fields.mode.stringValue !== mode) throw new Error('Invalid legacy mode.');
  const item = { type, mode, startDate: fields.startDate?.stringValue, endDate: fields.endDate?.stringValue };
  if (mode === 'cycle') {
    item.workDays = Number(fields.workDays?.integerValue ?? fields.workDays?.doubleValue);
    item.restDays = Number(fields.restDays?.integerValue ?? fields.restDays?.doubleValue);
    item.cycleStartDate = fields.cycleStartDate?.stringValue || item.startDate;
  }
  return item;
}

// Pure conversion: never touches credentials, disk or a remote service. A whole
// document is skipped if a single item is invalid; no silent partial migration.
export function buildSharedScheduleMigration(document) {
  if (!document?.name?.startsWith(`${COLLECTION_PATH}/`)
    || !/^RM-[A-Z0-9]{8}$/.test(document.name.slice(COLLECTION_PATH.length + 1))
    || typeof document.updateTime !== 'string' || !Number.isFinite(Date.parse(document.updateTime))) {
    return { status: 'invalid' };
  }
  const exceptions = document.fields?.exceptions;
  if (!exceptions) return { status: 'current' };
  if (!exceptions.arrayValue || (exceptions.arrayValue.values && !Array.isArray(exceptions.arrayValue.values))) {
    return { status: 'invalid' };
  }
  const values = exceptions.arrayValue.values || [];
  if (values.length > 30) return { status: 'invalid' };
  let legacy = false;
  try {
    const normalized = values.map((value) => {
      if (typeof value?.stringValue === 'string') {
        const decoded = decodeSharedExceptions([value.stringValue]);
        if (decoded.length !== 1) throw new Error('Invalid wire value.');
        return decoded[0];
      }
      legacy = true;
      return decodeLegacyMap(value);
    });
    const wire = encodeSharedExceptions(normalized);
    if (!legacy) return { status: 'current' };
    return {
      status: 'legacy',
      write: {
        update: { name: document.name, fields: { exceptions: { arrayValue: { values: wire.map((stringValue) => ({ stringValue })) } } } },
        updateMask: { fieldPaths: ['exceptions'] },
        currentDocument: { updateTime: document.updateTime },
        updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
      },
    };
  } catch {
    return { status: 'invalid' };
  }
}

async function authenticatedClient() {
  const require = createRequire(import.meta.url);
  const { logger } = require('firebase-tools/lib/logger');
  // No debug transport or credential-bearing error is ever printed by this script.
  logger.silent = true;
  const auth = require('firebase-tools/lib/auth');
  const { requireAuth } = require('firebase-tools/lib/requireAuth');
  const { Client } = require('firebase-tools/lib/apiv2');
  const account = auth.getProjectDefaultAccount(resolve(fileURLToPath(new URL('..', import.meta.url))));
  if (!account) throw new Error('Authentication unavailable.');
  const options = { project: PROJECT, projectId: PROJECT, nonInteractive: true };
  auth.setActiveAccount(options, account);
  await requireAuth(options, true);
  return new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1', auth: true });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    process.stdout.write('Uso: node scripts/migrate-shared-schedules.mjs [--apply]\nSin --apply sólo informa conteos. Proyecto fijo: rostermax-60242.\n');
    return;
  }
  if (args.some((arg) => arg !== '--apply') || args.length > 1) throw new Error('Invalid arguments.');
  const apply = args.includes('--apply');
  const client = await authenticatedClient();
  const counts = { mode: apply ? 'apply' : 'dry-run', scanned: 0, current: 0, legacy: 0, invalid: 0, migrated: 0, conflicts: 0, failed: 0 };
  let pageToken;
  do {
    const queryParams = new URLSearchParams({ pageSize: '100', 'mask.fieldPaths': 'exceptions' });
    if (pageToken) queryParams.set('pageToken', pageToken);
    const response = await client.get(COLLECTION_PATH, { queryParams, skipLog: SKIP_LOG });
    for (const document of response.body.documents || []) {
      counts.scanned += 1;
      const result = buildSharedScheduleMigration(document);
      counts[result.status] += 1;
      if (!apply || result.status !== 'legacy') continue;
      try {
        const commit = await client.post(`${DATABASE_PATH}:commit`, { writes: [result.write] }, {
          skipLog: SKIP_LOG, resolveOnHTTPError: true,
        });
        if (commit.status >= 200 && commit.status < 300) counts.migrated += 1;
        else if ([409, 412].includes(commit.status) || commit.body?.error?.status === 'FAILED_PRECONDITION') counts.conflicts += 1;
        else counts.failed += 1;
      } catch {
        counts.failed += 1;
      }
    }
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  process.stdout.write(`${JSON.stringify(counts)}\n`);
  if (counts.invalid || counts.conflicts || counts.failed) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    process.stderr.write('No se completó la revisión. Comprueba la sesión de Firebase, permisos de Firestore y argumentos. No se muestran credenciales ni datos de usuarios.\n');
    process.exitCode = 1;
  });
}
