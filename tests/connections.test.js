import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildReciprocalFriendRecord,
  buildSyncedFriendRecord,
  findExistingConnection,
} from '../src/lib/connections.js';

test('crea los dos lados de una vinculación con códigos normalizados', () => {
  const inviter = buildSyncedFriendRecord({ ownerUid: 'uid-a', name: 'Ana' }, 'rm-ab12cd34');
  const guest = buildReciprocalFriendRecord({
    uid: 'uid-b',
    name: 'Bruno',
    syncCode: 'rm-ef56gh78',
    inviteCode: 'rm-ab12cd34',
  });

  assert.deepEqual(inviter, {
    name: 'Ana', friendUid: 'uid-a', syncCode: 'RM-AB12CD34', isSynced: true,
  });
  assert.deepEqual(guest, {
    name: 'Bruno', friendUid: 'uid-b', syncCode: 'RM-EF56GH78', isSynced: true,
    reciprocal: true, inviteCode: 'RM-AB12CD34',
  });
});

test('detecta una conexión existente por uid o código', () => {
  const friends = [{ id: 'one', friendUid: 'uid-a', syncCode: 'RM-AB12CD34' }];
  assert.equal(findExistingConnection(friends, 'uid-a', 'RM-XXXXYYYY')?.id, 'one');
  assert.equal(findExistingConnection(friends, 'other', 'rm-ab12cd34')?.id, 'one');
  assert.equal(findExistingConnection(friends, 'other', 'RM-EF56GH78'), null);
});

test('rechaza reciprocidad sin un código propio válido', () => {
  assert.throws(() => buildReciprocalFriendRecord({
    uid: 'uid-b', name: 'Bruno', syncCode: '', inviteCode: 'RM-AB12CD34',
  }), /códigos válidos/);
});
