import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSharedScheduleMigration } from '../scripts/migrate-shared-schedules.mjs';

const document = {
  name: 'projects/rostermax-60242/databases/(default)/documents/artifacts/roster-max-production/public/data/sync_codes/RM-AAAAAAAA',
  updateTime: '2026-09-14T12:00:00.123456Z',
};
const legacy = { mapValue: { fields: {
  type: { stringValue: 'medical' }, mode: { stringValue: 'rest' },
  startDate: { stringValue: '2026-09-13' }, endDate: { stringValue: '2026-09-20' },
  label: { stringValue: 'Motivo médico privado' },
} } };
const withValues = (values) => ({ ...document, fields: { exceptions: { arrayValue: { values } } } });

test('migración cambia únicamente excepciones y exige versión servidor exacta', () => {
  const result = buildSharedScheduleMigration(withValues([legacy, { stringValue: 'W|2026-09-21|2026-09-22' }]));
  assert.equal(result.status, 'legacy');
  assert.deepEqual(result.write.currentDocument, { updateTime: document.updateTime });
  assert.deepEqual(result.write.updateMask.fieldPaths, ['exceptions']);
  assert.deepEqual(Object.keys(result.write.update.fields), ['exceptions']);
  assert.deepEqual(result.write.update.fields.exceptions.arrayValue.values, [
    { stringValue: 'N|2026-09-13|2026-09-20' }, { stringValue: 'W|2026-09-21|2026-09-22' },
  ]);
  assert.ok(!JSON.stringify(result).includes('Motivo'));
  assert.deepEqual(result.write.updateTransforms, [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }]);
});

test('migración no reescribe formatos actuales ni descarta parcialmente cambios inválidos', () => {
  assert.deepEqual(buildSharedScheduleMigration(withValues([{ stringValue: 'N|2026-09-13|2026-09-20' }])), { status: 'current' });
  assert.deepEqual(buildSharedScheduleMigration(document), { status: 'current' });
  assert.deepEqual(buildSharedScheduleMigration(withValues([legacy, { stringValue: 'malformed' }])), { status: 'invalid' });
  assert.deepEqual(buildSharedScheduleMigration(withValues(Array(31).fill(legacy))), { status: 'invalid' });
  assert.equal(buildSharedScheduleMigration(withValues(Array(30).fill(legacy))).write.update.fields.exceptions.arrayValue.values.length, 30);
});

test('migración rechaza otros proyectos, rutas privadas, códigos y precondiciones ausentes', () => {
  for (const changes of [
    { name: document.name.replace('rostermax-60242', 'other-project') },
    { name: document.name.replace('public/data/sync_codes', 'users/someone/tasks') },
    { name: `${document.name}/child` },
    { updateTime: undefined }, { updateTime: 'invalid' },
  ]) {
    assert.deepEqual(buildSharedScheduleMigration({ ...withValues([legacy]), ...changes }), { status: 'invalid' });
  }
});
