const SYNC_CODE_PATTERN = /^RM-[A-Z0-9]{8}$/;

export function normalizeSyncCode(value) {
  return String(value || '').trim().toUpperCase();
}
export function isValidSyncCode(value) {
  return SYNC_CODE_PATTERN.test(normalizeSyncCode(value));
}

export function createSyncCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `RM-${code}`;
}
