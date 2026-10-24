import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { getAudienceSummary } from '../lib/analytics';

const time = (value) => value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(value) : '—';
function Metric({ label, value, hint, source, period, updatedAt, coverage, light }) {
  return <div className={'rounded-xl p-3 ' + (light ? 'bg-slate-50' : 'bg-slate-800/60')}>
    <p className="text-sm opacity-75">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{Number.isSafeInteger(value) && value >= 0 ? value : '—'}</p>
    <details className="mt-1 text-xs opacity-75"><summary className="cursor-pointer py-1">Definición y fuente</summary><p>{hint}</p><p>Fuente: {source}. Período: {period}. Cobertura: {coverage}. Actualización: {time(updatedAt)}.</p></details>
  </div>;
}
export default function CeoAudiencePanel({ theme, census, censusState, activityState, audience, refreshing, refreshError, onRefresh, activityUpdatedAt, activityDocs, ownerUid }) {
  const [excludeOwner, setExcludeOwner] = useState(false), [testIds, setTestIds] = useState('');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const filtered = activityDocs?.filter((d) => !(excludeOwner && d.ownerUid === ownerUid) && !testIds.split(/[\s,]+/).filter(Boolean).includes(d.ownerUid));
  const measuredAudience = filtered ? getAudienceSummary(filtered, now) : audience;
  const light = theme === 'light', card = 'rounded-2xl border p-5 ' + (light ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800');
  const generatedAt = census?.generatedAt?.seconds ? new Date(census.generatedAt.seconds * 1000) : null;
  const stale = generatedAt && now.getTime() - generatedAt.getTime() > 86400000;
  const activityKnown = Boolean(activityUpdatedAt) || activityState === 'ready';
  const measured = (key) => activityKnown ? measuredAudience[key] : null;
  const base = { source: 'Firebase Authentication, consulta administrativa completa', period: 'foto al momento del censo', updatedAt: generatedAt, coverage: 'todas las cuentas técnicas; incluye propietario y pruebas sin exclusiones', light };
  const voluntary = { source: 'activity, lastActiveAt de cuenta con consentimiento', updatedAt: activityUpdatedAt, coverage: activityKnown ? measuredAudience.measuredUsers + ' cuentas medidas tras los filtros visibles; no extrapolable al total' : 'sin información confirmada', light };
  return <section aria-label="Cuentas y actividad del CEO" className="space-y-4">
    <div className={card}><h3 className="font-bold text-lg">Cuentas registradas</h3><p className="mt-2 text-sm">El censo es independiente del consentimiento. Cuentas no equivale a personas, instalaciones ni descargas.</p>
      {censusState === 'loading' && <p role="status" className="mt-3">Cargando el último censo…</p>}
      {censusState === 'error' && <p role="alert" className="mt-3 text-amber-500">No pudimos leer un censo válido de este entorno. Conservamos el último resultado correcto, si existe; no significa cero cuentas.</p>}
      {censusState === 'stale' && <p role="status" className="mt-3 text-amber-500">Conexión sin confirmar; última lectura conservada.</p>}
      {censusState === 'ready' && !census && <p role="status" className="mt-3 text-amber-500">Todavía no hay un censo guardado. Actualízalo con la cuenta propietaria de Firebase.</p>}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        <Metric {...base} label="Cuentas guardadas" value={census?.registeredAccounts} hint="Cuentas con proveedor vinculado o autenticación personalizada; no son descargas."/>
        <Metric {...base} label="Vinculadas con Google" value={census?.googleAccounts} hint="Subconjunto de cuentas guardadas con proveedor google.com, incluida la propietaria."/>
        <Metric {...base} label="Cuentas de invitado" value={census?.guestAccounts} hint="Sin proveedor vinculado. Dispositivos, navegación privada y pruebas pueden crear varias por persona."/>
        <Metric {...base} label="Total técnico" value={census?.totalAccounts} hint="Guardadas más invitadas; incluye deshabilitadas."/>
        <Metric {...base} label="Deshabilitadas" value={census?.disabledAccounts} hint="Cuentas con disabled=true; es un subconjunto del total, no se suma otra vez."/>
      </div>
      <p className={'mt-3 text-xs ' + (stale ? 'text-amber-500' : 'opacity-75')}>Censo del {time(generatedAt)} · {stale ? 'Dato desactualizado: más de 24 horas.' : 'Foto del momento, no contador en vivo.'} Incluye propietario y pruebas. No hay filtros invisibles.</p>
      <button type="button" disabled={refreshing} onClick={onRefresh} className="mt-4 min-h-11 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white flex justify-center items-center gap-2 disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>{refreshing ? 'Consultando todas las cuentas…' : 'Actualizar censo con Google'}</button>
      <p className="mt-2 text-xs opacity-75">Actualización MANUAL. La cuenta propietaria debe autorizar la lectura administrativa en Google. No guardamos identidades ni credenciales. Una consulta incompleta no reemplaza el censo anterior.</p>
      {refreshError && <p role="alert" className="mt-3 text-sm text-amber-500">{refreshError}</p>}
      <details className="mt-3"><summary className="cursor-pointer py-2 text-sm">Altas y accesos de autenticación</summary><p className="mb-3 text-xs opacity-75">Altas = cuentas creadas, de todos los tipos, incluidas deshabilitadas. La clasificación guardada/invitada corresponde al estado actual, no al proveedor que tenían al crearse. Login no significa abrir la app.</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{[['24Hours', '24 horas'], ['7Days', '7 días'], ['30Days', '30 días']].flatMap(([suffix, label]) => [
          <Metric key={'all'+suffix} {...base} period={label + ' previos al censo'} label={'Altas en ' + label} value={census?.['createdLast'+suffix]} hint="Todos los tipos de cuenta, incluidas invitadas."/>,
          <Metric key={'registered'+suffix} {...base} period={label + ' previos al censo'} label={'Altas guardadas · '+label} value={census?.['createdRegisteredLast'+suffix]} hint="Altas actualmente vinculadas con un proveedor. Un censo antiguo puede no contener este desglose."/>,
          <Metric key={'guest'+suffix} {...base} period={label + ' previos al censo'} label={'Altas invitadas · '+label} value={census?.['createdGuestLast'+suffix]} hint="Altas actualmente sin proveedor. No equivale a visitantes únicos."/>,
          <Metric key={'login'+suffix} {...base} period={label + ' previos al censo'} label={'Cuentas con login · '+label} value={census?.['signInsLast'+suffix]} hint="Cuentas cuyo último login está dentro de la ventana; no usuarios activos ni número de autenticaciones."/>
        ])}</div>
      </details>
    </div>
    <div className={card}><h3 className="font-bold text-lg">Actividad medida · voluntaria</h3><p className="mt-2 text-sm">Cuentas con “Ayudar a mejorar RosterMax”. Se actualiza cuando la app visible registra actividad, aproximadamente cada 15 minutos. No contamos aperturas individuales ni construimos tendencias desde el último acceso.</p>
      <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={excludeOwner} onChange={(e) => setExcludeOwner(e.target.checked)}/>Excluir mi cuenta de la actividad medida</label>
      <label className="mt-2 block text-sm">UID de pruebas a excluir de actividad<input className="mt-1 w-full rounded-lg border border-blue-500/30 bg-transparent p-2" value={testIds} onChange={(e) => setTestIds(e.target.value)} placeholder="Identificadores explícitos, separados por espacios"/></label>
      {activityState === 'error' && <p role="alert" className="mt-3 text-amber-500">La actualización falló. Conservamos la última muestra válida; “—” significa que no existe una lectura confirmada.</p>}
      {activityState === 'loading' && <p role="status" className="mt-3">Cargando actividad…</p>}
      {activityState === 'stale' && <p role="status" className="mt-3 text-amber-500">Muestra guardada sin actualización de servidor.</p>}
      {activityKnown && measuredAudience.measuredUsers === 0 && <p className="mt-3 text-sm">Sin muestra de actividad. Puede haber usuarios e instalaciones aunque nadie haya activado las métricas.</p>}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        <Metric {...voluntary} period="todo lo conservado" label="Cuentas con medición" value={measured('measuredUsers')} hint="Documentos voluntarios actuales tras exclusiones; no todo el censo."/>
        {[['activeDay','24 h'], ['activeWeek','7 días'], ['activeMonth','30 días']].map(([key,label]) => <Metric key={key} {...voluntary} period={'ventana móvil de '+label} label={'Activas medidas · '+label} value={measured(key)} hint="Cuentas cuya última actividad visible medida ocurrió dentro de la ventana; no personas ni aperturas."/> )}
        <Metric {...voluntary} period="estado más reciente conservado" label="Cuentas con instalación detectada" value={measured('installsDetected')} hint="Detección parcial de PWA; no mide descargas totales, dispositivos únicos ni desinstalaciones."/>
        <Metric {...voluntary} period="estado más reciente conservado" label="Con roster configurado · muestra" value={measured('configuredRosters')} hint="Cuentas voluntarias que informaron un diagrama válido; no implica que el CEO pueda leerlo."/>
      </div><p className="mt-3 text-xs flex gap-2 opacity-75"><ShieldCheck size={16}/>Para anuncios, presenta fuente, período y cobertura. Nunca extrapoles la muestra como alcance garantizado.</p>
    </div>
  </section>;
}
