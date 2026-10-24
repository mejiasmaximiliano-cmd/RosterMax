import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, doc, getDocFromServer, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { APP_ID, db } from './firebase';
import { buildCompensatoryChange } from './compensatories';

function readOutbox(uid) {
  try { const value = JSON.parse(localStorage.getItem(`rostermax:compensatories:${uid}`) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

export function useCompensatories(user, { open, onConfirmed } = {}) {
  const [debts, setDebts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [state, setState] = useState('loading');
  const [historyState, setHistoryState] = useState('loading');
  const [error, setError] = useState('');
  const [outbox, setOutbox] = useState(() => readOutbox(user.uid));
  const [busy, setBusy] = useState(false);
  const headsRef = useRef([]);
  const outboxRef = useRef(outbox);
  const busyRef = useRef(false);
  const confirmedCallback = useRef(onConfirmed);
  useEffect(() => { confirmedCallback.current = onConfirmed; }, [onConfirmed]);
  const persist = useCallback((records) => {
    localStorage.setItem(`rostermax:compensatories:${user.uid}`, JSON.stringify(records));
    outboxRef.current = records; setOutbox(records);
  }, [user.uid]);
  const acknowledge = useCallback((id) => {
    const latest = readOutbox(user.uid);
    const pending = latest.find((item) => item.id === id);
    if (!pending) { if (outboxRef.current.some((item) => item.id === id)) persist(latest); return; }
    persist(latest.filter((item) => item.id !== id));
    confirmedCallback.current?.({ operationId: id, receipt: `compensatory_entries/${id}`, type: 'compensatory_recorded' });
  }, [persist, user.uid]);
  useEffect(() => onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'compensatory_debts'), { includeMetadataChanges: true }, (snapshot) => {
    const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data(), pending: item.metadata.hasPendingWrites }));
    headsRef.current = records; setDebts(records);
    setState(snapshot.metadata.fromCache ? (records.length ? 'cached' : 'loading') : 'ready');
  }, () => { setState('error'); setError('No pudimos leer tus compensatorios. Conservamos la última información disponible.'); }), [user.uid]);
  useEffect(() => {
    if (!open && !outbox.length) return undefined;
    return onSnapshot(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'compensatory_entries'), { includeMetadataChanges: true }, (snapshot) => {
      setEntries(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), pending: item.metadata.hasPendingWrites })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0) || b.revision - a.revision));
      setHistoryState(snapshot.metadata.fromCache ? 'cached' : 'ready');
      if (!snapshot.metadata.fromCache) {
        snapshot.docs.filter((item) => !item.metadata.hasPendingWrites).forEach((item) => acknowledge(item.id));
        const missing = outboxRef.current.filter((item) => item.status === 'queued' && !snapshot.docs.some((d) => d.id === item.id) && !headsRef.current.some((head) => head.pending && head.lastEventId === item.id));
        if (missing.length && !busyRef.current) {
          persist(outboxRef.current.map((item) => missing.some((m) => m.id === item.id) ? { ...item, status: 'error' } : item));
          setError('Hay un intento local sin confirmación ni escritura en cola. Revísalo para reintentar con el mismo identificador.');
        }
      }
    }, () => { setHistoryState('error'); setError('No pudimos actualizar el historial. Tus intentos pendientes siguen guardados en este dispositivo.'); });
  }, [user.uid, open, outbox.length, acknowledge, persist]);

  const submit = useCallback(async (input) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const existing = readOutbox(user.uid).find((item) => item.id === input.id);
      if (existing?.status === 'queued') return true;
      const eventRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'compensatory_entries', input.id);
      if (existing && navigator.onLine) {
        if ((await getDocFromServer(eventRef)).exists()) { acknowledge(input.id); return true; }
      }
      const debt = headsRef.current.find((item) => item.id === input.debtId);
      const { head, event } = buildCompensatoryChange({ ...input, debt });
      persist([...readOutbox(user.uid).filter((item) => item.id !== input.id), { ...input, status: 'queued' }]);
      const batch = writeBatch(db);
      const headRef = doc(db, 'artifacts', APP_ID, 'users', user.uid, 'compensatory_debts', input.debtId);
      if (debt) batch.update(headRef, { ...head, updatedAt: serverTimestamp() });
      else batch.set(headRef, { ...head, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.set(eventRef, { ...event, createdAt: serverTimestamp() });
      const completion = batch.commit().then(() => { acknowledge(input.id); return true; }).catch(() => {
        persist(readOutbox(user.uid).map((item) => item.id === input.id ? { ...item, status: 'error' } : item));
        setError('El servidor no confirmó un movimiento. Puede haber cambiado el saldo en otro dispositivo. Revisa el intento guardado y vuelve a intentarlo.');
        return false;
      });
      headsRef.current = [...headsRef.current.filter((item) => item.id !== input.debtId), { ...head, id: input.debtId, pending: true }];
      setDebts(headsRef.current);
      if (!navigator.onLine) return true;
      return await completion;
    } catch (failure) { setError(failure?.code ? 'No se pudo comprobar el movimiento. Revisa tu conexión.' : failure.message); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }, [user.uid, persist, acknowledge]);
  const discardFailed = (id) => persist(outboxRef.current.filter((item) => item.id !== id || item.status !== 'error'));
  return { debts, entries, state, historyState, error, outbox, busy, submit, discardFailed };
}
