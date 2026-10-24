import { useCallback, useEffect, useRef } from 'react';
import { doc, getDocFromServer, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { APP_ID, db } from './firebase';
import { FEATURE_TYPES } from './featureMetrics';

// This queue contains identifiers/types only, never notes, amounts or dates of leave.
export function useFeatureMeasurement(user, enabled) {
  const key = `rostermax:measurement:${APP_ID}:${user.uid}`;
  const active = useRef(enabled);
  const flushing = useRef(false);
  useEffect(() => { active.current = enabled; }, [enabled]);
  const flush = useCallback(async () => {
    if (!active.current || !navigator.onLine || flushing.current) return;
    flushing.current = true;
    try {
      const queue = JSON.parse(localStorage.getItem(key) || '[]');
      for (const op of queue) {
        if (!active.current) break;
        if (!Object.hasOwn(FEATURE_TYPES, op.type) || !/^[A-Za-z0-9_-]{1,80}$/.test(op.operationId) || !/^(operation_receipts|compensatory_entries)\/[A-Za-z0-9_-]{1,80}$/.test(op.receipt)) continue;
        const receipt = await getDocFromServer(doc(db, 'artifacts', APP_ID, 'users', user.uid, ...op.receipt.split('/')));
        if (!receipt.exists() || !receipt.data().createdAt) continue;
        const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'feature_events', `${user.uid}_${op.operationId}`);
        await runTransaction(db, async (transaction) => {
          const existing = await transaction.get(ref);
          if (!existing.exists() && active.current) transaction.set(ref, { ownerUid: user.uid, type: op.type, occurredAt: receipt.data().createdAt, recordedAt: serverTimestamp() });
        });
        const remaining = JSON.parse(localStorage.getItem(key) || '[]').filter((item) => item.operationId !== op.operationId);
        localStorage.setItem(key, JSON.stringify(remaining));
      }
    } catch { /* Optional telemetry never blocks private saves. Retry uses the same ID. */ }
    finally { flushing.current = false; }
  }, [key, user.uid]);
  const enqueue = useCallback((operation) => {
    if (!active.current) return;
    try {
      const queue = JSON.parse(localStorage.getItem(key) || '[]');
      if (!queue.some((item) => item.operationId === operation.operationId)) localStorage.setItem(key, JSON.stringify([...queue, operation]));
    } catch { return; }
    void flush();
  }, [key, flush]);
  useEffect(() => {
    if (enabled === undefined) return undefined;
    if (!enabled) { localStorage.removeItem(key); return undefined; }
    void flush();
    const timer = setInterval(flush, 15000);
    window.addEventListener('online', flush); window.addEventListener('focus', flush);
    return () => { clearInterval(timer); window.removeEventListener('online', flush); window.removeEventListener('focus', flush); };
  }, [enabled, flush, key]);
  const write = (ref, data, type, options = {}) => {
    if (!active.current) { const batch = writeBatch(db); batch.set(ref, data, options); return batch.commit(); }
    const operationId = crypto.randomUUID();
    const receipt = `operation_receipts/${operationId}`;
    enqueue({ operationId, receipt, type });
    const batch = writeBatch(db);
    batch.set(ref, data, options);
    batch.set(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'operation_receipts', operationId), { type, createdAt: serverTimestamp() });
    return batch.commit().then((result) => { void flush(); return result; });
  };
  return { enqueue, write };
}
