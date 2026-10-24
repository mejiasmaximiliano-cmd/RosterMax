import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import { APP_ID, db } from '../lib/firebase';
import { FEATURE_TYPES, summarizeFeatureEvents } from '../lib/featureMetrics';

function useAdminCollection(path) {
  const [result, setResult] = useState({ state: 'loading', rows: null, updatedAt: null });
  useEffect(() => onSnapshot(collection(db, 'artifacts', APP_ID, ...path.split('/')), { includeMetadataChanges: true }, (snapshot) => {
    // A cold empty cache is not evidence of zero server records.
    setResult((current) => snapshot.metadata.fromCache ? { ...current, state: current.rows ? 'stale' : 'loading' } : { state: 'ready', rows: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })), updatedAt: new Date() });
  }, () => setResult((current) => ({ ...current, state: 'error' }))), [path]);
  return result;
}
function Source({ result, children }) {
  return <p className="mt-2 text-xs leading-relaxed opacity-75">{children} · {result.state === 'ready' ? 'Lectura confirmada' : result.state === 'error' ? 'Error: conservamos la última lectura válida' : result.state === 'stale' ? 'Datos guardados, sin actualización confirmada' : 'Cargando; sin información confirmada'} · Última lectura: {result.updatedAt?.toLocaleString('es-AR') || '—'}.</p>;
}
export default function CeoOperationsPanel({ user, theme }) {
  const events = useAdminCollection('public/data/feature_events');
  const audit = useAdminCollection('admin_audit');
  const feedback = useAdminCollection('public/data/feedback');
  const [days, setDays] = useState(30);
  const [excludeOwner, setExcludeOwner] = useState(false);
  const [testUids, setTestUids] = useState('');
  const [message, setMessage] = useState('');
  const [feedbackFilter, setFeedbackFilter] = useState('pending');
  const excluded = useMemo(() => [...(excludeOwner ? [user.uid] : []), ...testUids.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)], [excludeOwner, testUids, user.uid]);
  const summary = summarizeFeatureEvents(events.rows, { days, excludedUids: excluded });
  const card = `rounded-2xl border p-5 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`;
  const input = 'rounded-lg border border-blue-500/30 bg-transparent p-2 text-sm';
  const attend = async (id, status) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'feedback', id), { status, updatedAt: serverTimestamp() });
      batch.set(doc(collection(db, 'artifacts', APP_ID, 'admin_audit')), { actorUid: user.uid, action: 'feedback_status', targetId: id, createdAt: serverTimestamp() });
      await batch.commit(); setMessage('Estado de atención confirmado.');
    } catch { setMessage('No se confirmó el cambio de estado. Conservamos el comentario.'); }
  };
  return <section aria-label="Operación y funciones CEO" className="space-y-4">
    <div className={card}>
      <h3 className="font-bold">Uso agregado de funciones · medición nueva</h3>
      <p className="mt-2 text-sm">Solo operaciones de cuentas con consentimiento. No leemos montos, planes, notas, licencias ni compensatorios personales. Guardar o corregir un plan cuenta como una operación, no como una persona ni una apertura.</p>
      <div className="mt-3 flex flex-wrap gap-3"><label className="text-sm">Período <select aria-label="Período de uso de funciones" className={input} value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={1}>24 horas</option><option value={7}>7 días</option><option value={30}>30 días</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={excludeOwner} onChange={(e) => setExcludeOwner(e.target.checked)}/>Excluir mi cuenta de esta muestra</label></div>
      <label className="mt-3 block text-sm">UID de cuentas de prueba a excluir (identificación explícita)<input className={`${input} mt-1 w-full`} value={testUids} onChange={(e) => setTestUids(e.target.value)} placeholder="Separados por espacios o comas"/></label>
      <p className="mt-2 text-xs opacity-75">Estos filtros se aplican solo al uso de funciones, no al censo ni a las campañas. Sin exclusiones automáticas. {summary.excluded} eventos excluidos; cobertura: {events.rows ? summary.accounts : '—'} cuentas con al menos una operación en el período.</p>
      <div aria-label="Cobertura de funciones antes y después de filtros" className="mt-3 rounded-xl border border-blue-500/30 p-3 text-sm"><p>Antes de filtros: {events.rows ? summary.beforeAccounts : '—'} cuentas medidas en el período · Excluidas: {events.rows ? summary.excludedAccounts : '—'} · Incluidas: {events.rows ? summary.accounts : '—'}.</p>{events.rows && summary.beforeAccounts === 0 && <p>No hay operaciones medidas en el período antes de filtrar.</p>}{events.rows && summary.beforeAccounts > 0 && summary.accounts === 0 && <p>La muestra quedó vacía por los filtros; había operaciones medidas.</p>}</div>
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-3 gap-3">{Object.entries(FEATURE_TYPES).map(([type, label]) => <div key={type} className="rounded-xl bg-blue-500/5 p-3"><p className="text-sm">{label}</p><p className="text-2xl font-black">{events.rows ? summary.totals[type] : '—'}</p><p className="text-xs opacity-70">Operaciones confirmadas · {days === 1 ? '24 h' : `${days} días`}</p></div>)}</div>
      <Source result={events}>Fuente: feature_events · fecha del movimiento confirmada por servidor; reintentos con ID estable</Source>
      <p className="mt-2 text-xs opacity-75">Primer evento conservado: {summary.since ? new Date(summary.since).toLocaleString('es-AR') : 'sin información; no hay una fecha de inicio confirmada'}. La nueva medición comienza al publicar esta versión y recibir consentimiento; no reconstruye usos antiguos. Los eventos pueden borrarse por privacidad, por lo que esta fecha no es un histórico garantizado.</p>
    </div>
    <div className={card}><h3 className="font-bold">Feedback y atención</h3><Source result={feedback}>Fuente: feedback enviado voluntariamente · período: todo lo conservado · cobertura: {feedback.rows?.length ?? '—'} comentarios</Source><div className="mt-3 grid grid-cols-3 gap-2">{[['new', 'Nuevos'], ['in_progress', 'En atención'], ['resolved', 'Resueltos']].map(([status, label]) => <p key={status} className="rounded-xl bg-blue-500/5 p-3 text-sm">{label}: {feedback.rows ? feedback.rows.filter((f) => (f.status || 'new') === status).length : '—'}</p>)}</div>
      <label className="mt-3 block text-sm">Mostrar comentarios<select className={`${input} mt-1 w-full`} value={feedbackFilter} onChange={(e) => setFeedbackFilter(e.target.value)}><option value="pending">Pendientes de atención</option><option value="all">Todos los comentarios conservados</option><option value="resolved">Resueltos</option></select></label>
      {(feedback.rows || []).filter((item) => feedbackFilter === 'all' || (feedbackFilter === 'pending' ? item.status !== 'resolved' : item.status === 'resolved')).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((item) => <div key={item.id} className="mt-3 border-t border-slate-500/20 pt-3"><p className="text-sm whitespace-pre-wrap">{item.message}</p><label className="mt-2 block text-sm">Estado de atención<select className={`${input} ml-2`} value={item.status || 'new'} onChange={(e) => attend(item.id, e.target.value)}><option value="new">Nuevo</option><option value="in_progress">En atención</option><option value="resolved">Resuelto</option></select></label></div>)}
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </div>
    <div className={card}><h3 className="font-bold">Actividad administrativa</h3><Source result={audit}>Fuente: admin_audit · todo lo conservado desde esta versión · solo acciones instrumentadas, no auditoría de la consola Firebase</Source>{audit.rows?.length === 0 && <p className="mt-3 text-sm">Ninguna acción registrada por esta versión.</p>}<ul className="mt-3 space-y-2 text-sm">{[...(audit.rows || [])].sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0,30).map((item) => <li key={item.id}>{({ census_refreshed: 'Censo actualizado manualmente', campaign_created: 'Campaña creada', campaign_paused: 'Campaña pausada', feedback_status: 'Feedback atendido' })[item.action] || 'Acción registrada'} · {item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleString('es-AR') : 'pendiente'}</li>)}</ul></div>
  </section>;
}
