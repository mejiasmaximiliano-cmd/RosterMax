import { isValidSyncCode, normalizeSyncCode } from './sync.js';

function normalizeName(value) {
  return String(value || '').trim().slice(0, 40) || 'Compañero RosterMax';
}

export function findExistingConnection(friends, ownerUid, rawCode) {
  const code = normalizeSyncCode(rawCode);
  return (friends || []).find((friend) => (
    friend.friendUid === ownerUid || normalizeSyncCode(friend.syncCode) === code
  )) || null;
}

export function buildSyncedFriendRecord(sharedRoster, rawCode) {
  const code = normalizeSyncCode(rawCode);
  if (!sharedRoster?.ownerUid || !isValidSyncCode(code)) {
    throw new Error('El roster compartido no es válido.');
  }

  return {
    name: normalizeName(sharedRoster.name),
    friendUid: sharedRoster.ownerUid,
    syncCode: code,
    isSynced: true,
  };
}

export function buildReciprocalFriendRecord({ uid, name, syncCode, inviteCode }) {
  const ownCode = normalizeSyncCode(syncCode);
  const acceptedCode = normalizeSyncCode(inviteCode);
  if (!uid || !isValidSyncCode(ownCode) || !isValidSyncCode(acceptedCode)) {
    throw new Error('No se puede crear una vinculación recíproca sin códigos válidos.');
  }

  return {
    name: normalizeName(name),
    friendUid: uid,
    syncCode: ownCode,
    isSynced: true,
    reciprocal: true,
    inviteCode: acceptedCode,
  };
}
