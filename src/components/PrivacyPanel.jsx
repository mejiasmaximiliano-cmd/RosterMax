import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocsFromServer, limit, query, serverTimestamp, setDoc, where, writeBatch } from 'firebase/firestore';
import { APP_ID, db } from '../lib/firebase';

const PRIVATE_COLLECTIONS = ['settings', 'tasks', 'goals', 'logs', 'friends', 'schedule_exceptions', 'expenses', 'compensatory_debts', 'compensatory_entries', 'operation_receipts'];
export default function PrivacyPanel({ user, theme }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const contact = String(import.meta.env.VITE_PRIVACY_CONTACT_EMAIL || '').trim();
  const controller = String(import.meta.env.VITE_PRIVACY_CONTROLLER || '').trim();
  const run = async (work) => {
    if (busy) return;
    if (!navigator.onLine) { setMessage('Conéctate para consultar o confirmar cambios en el servidor.'); return; }
    setBusy(true); setMessage('');
    try { await work(); } catch { setMessage('La operación no se completó. No anunciamos una eliminación o exportación completa sin confirmación. Puedes reintentar.'); }
    finally { setBusy(false); }
  };
  const exportData = () => run(async () => {
    const data = { schemaVersion: 1, exportedAt: new Date().toISOString(), scope: 'Colecciones privadas conocidas confirmadas por servidor; no incluye copias de compañeros ni exportaciones anteriores', uid: user.uid, collections: {} };
    for (const name of PRIVATE_COLLECTIONS) {
      const snapshot = await getDocsFromServer(collection(db, 'artifacts', APP_ID, 'users', user.uid, name));
      data.collections[name] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    const pending = localStorage.getItem(`rostermax:compensatories:${user.uid}`);
    if (pending) data.localCompensatoryIntents = JSON.parse(pending);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'rostermax-mis-datos.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    setMessage('Exportación privada preparada. Contiene información sensible en texto: guárdala en un lugar seguro.');
  });
  const eraseMeasurement = () => run(async () => {
    if (!window.confirm('¿Desactivar y borrar tu actividad y métricas de funciones/campañas? No borra planes, finanzas ni compensatorios.')) return;
    await setDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'settings', 'privacy'), { analyticsEnabled: false, updatedAt: serverTimestamp() }, { merge: true });
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'activity', user.uid));
    for (const name of ['feature_events', 'campaign_metrics']) {
      for (;;) {
        const snapshot = await getDocsFromServer(query(collection(db, 'artifacts', APP_ID, 'public', 'data', name), where('ownerUid', '==', user.uid), limit(200)));
        if (!snapshot.size) break;
        const batch = writeBatch(db); snapshot.docs.forEach((d) => batch.delete(d.ref)); await batch.commit();
        if (snapshot.size < 200) break;
      }
    }
    setMessage('Medición desactivada y registros de actividad, funciones y campañas de tu cuenta eliminados del servidor. No retira informes o copias anteriores.');
  });
  const requestErasure = () => run(async () => {
    if (!window.confirm('Se enviará una solicitud de eliminación vinculada a tu cuenta. Requiere atención manual; pulsar este botón no borra tus datos. ¿Enviar?')) return;
    const request = await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'feedback'), { ownerUid: user.uid, name: 'Solicitud de privacidad', category: 'privacy', message: 'Solicito la eliminación de mi cuenta y sus datos. Requiere atención manual y confirmación de identidad antes de ejecutarse.', status: 'new', createdAt: serverTimestamp() });
    setMessage(`Solicitud recibida: ${request.id}. Pendiente de atención manual; la cuenta y sus datos todavía existen.`);
  });
  return <section aria-label="Privacidad y mis datos" className={`rounded-2xl border p-5 space-y-3 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}>
    <h3 className="font-bold">Privacidad y mis datos</h3>
    <p className="text-sm">El roster compartido no incluye motivos de licencia ni notas. Planes, finanzas y compensatorios pertenecen a tu cuenta; el CEO no puede leerlos. El feedback es un envío voluntario al propietario: no incluyas datos sensibles.</p>
    <p className="text-sm">Hay una copia local para trabajar sin señal. Evita guardar datos sensibles en dispositivos compartidos. Quien tenga tu código y una sesión puede consultar tu disponibilidad; retirar la compartición no borra copias ya vistas.</p>
    <div className="flex flex-wrap gap-3">{[['Exportar mis datos privados', exportData], ['Desactivar y borrar mi medición', eraseMeasurement], ['Solicitar eliminación de mi cuenta', requestErasure]].map(([label, action]) => <button key={label} type="button" disabled={busy} onClick={action} className="min-h-11 rounded-xl border border-blue-500/30 p-3 text-sm font-bold text-blue-500 disabled:opacity-50">{label}</button>)}</div>
    <p className="text-xs opacity-75">La exportación consulta el servidor, no presenta una caché parcial como respaldo completo. El borrado de cuenta es manual. Cerrar sesión o desinstalar no elimina tu cuenta ni exportaciones a Calendar/ICS.</p>
    {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) && controller ? <p className="text-sm">Responsable informado: {controller}. Contacto: <a className="underline" href={`mailto:${contact}`}>{contact}</a>.</p> : <p className="text-sm text-amber-500">Falta completar responsable, contacto, conservación y política definitiva antes del lanzamiento comercial. Estos controles no son una promesa de cumplimiento legal.</p>}
    {message && <p role="status" className="rounded-xl bg-blue-500/10 p-3 text-sm break-words">{message}</p>}
  </section>;
}
