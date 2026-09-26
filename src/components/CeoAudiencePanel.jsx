import { AlertCircle, BarChart3, RefreshCw, ShieldCheck, Users } from 'lucide-react';

function Metric({ label, value, hint, light }) {
  return <div className={`rounded-xl p-3 ${light ? 'bg-slate-50' : 'bg-slate-800/60'}`}><p className="text-xs opacity-75">{label}</p><p className="mt-1 text-2xl font-black tabular-nums">{Number.isSafeInteger(value) && value >= 0 ? value : '—'}</p>{hint && <p className="mt-1 text-[11px] opacity-70 leading-relaxed">{hint}</p>}</div>;
}

export default function CeoAudiencePanel({ theme, census, censusState, activityState, audience, refreshing, refreshError, onRefresh, today }) {
  const light = theme === 'light';
  const card = light ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800';
  const muted = light ? 'text-slate-600' : 'text-slate-400';
  const generatedAt = census?.generatedAt?.seconds ? new Date(census.generatedAt.seconds * 1000) : null;
  const stale = generatedAt && today && new Date(`${today}T00:00:00`).getTime() - generatedAt.getTime() > 86400000;
  const activityReady = activityState === 'ready';
  const measured = (key) => activityReady ? audience[key] : null;
  return <section aria-label="Cuentas y actividad del CEO" className="space-y-4">
    <div className={`rounded-2xl border p-5 ${card}`}>
      <h3 className="font-bold flex items-center gap-2"><Users size={19} className="text-blue-500"/>Cuentas registradas</h3>
      <p className={`mt-1 text-xs leading-relaxed ${muted}`}>Censo de Firebase Authentication. Es independiente de las métricas opcionales: una cuenta existe aunque no haya aceptado medición.</p>
      {censusState === 'loading' && <p role="status" className="mt-3 text-sm">Cargando el último censo…</p>}
      {censusState === 'error' && <p role="alert" className="mt-3 text-sm text-amber-500">No pudimos leer el censo. Esto no significa que haya cero usuarios. Revisa la conexión y recarga.</p>}
      {censusState === 'ready' && !census && <p role="status" className="mt-3 text-sm text-amber-500">Todavía no hay un censo guardado. Actualízalo con tu cuenta propietaria de Firebase.</p>}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Metric label="Cuentas guardadas" value={census?.registeredAccounts} hint="Vinculadas a un proveedor; no son descargas." light={light}/>
        <Metric label="Vinculadas con Google" value={census?.googleAccounts} hint="Incluye tu cuenta propietaria." light={light}/>
        <Metric label="Cuentas de invitado" value={census?.guestAccounts} hint="Un dispositivo o una prueba puede crear otra. No equivalen a personas." light={light}/>
        <Metric label="Total técnico" value={census?.totalAccounts} hint="Guardadas + invitados; incluye cuentas deshabilitadas." light={light}/>
      </div>
      {generatedAt && <p className={`mt-3 text-xs ${stale ? 'text-amber-500' : muted}`}>Censo del {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(generatedAt)}{stale ? ' · Actualiza para ver cambios recientes.' : ' · Es una foto de ese momento, no un contador en vivo.'}</p>}
      <button type="button" disabled={refreshing} onClick={onRefresh} className="mt-4 min-h-11 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white flex justify-center items-center gap-2 disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>{refreshing ? 'Consultando todas las cuentas…' : 'Actualizar censo con Google'}</button>
      <p className={`mt-2 text-[11px] leading-relaxed ${muted}`}>Sólo el propietario con permisos de Firebase puede autorizar esta consulta en Google. Se guardan totales, nunca correos, nombres ni credenciales.</p>
      {refreshError && <p role="alert" className="mt-3 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-500 flex gap-2"><AlertCircle size={16} className="shrink-0"/>{refreshError}</p>}
      {census && <details className="mt-3 text-xs"><summary className={`cursor-pointer py-2 ${muted}`}>Altas y accesos de autenticación</summary><p className={`mb-3 leading-relaxed ${muted}`}>Un inicio de sesión no es lo mismo que abrir la app: una persona puede seguir conectada durante semanas. No uses estos accesos como usuarios activos diarios.</p><div className="grid grid-cols-2 gap-2"><Metric label="Altas en 7 días" value={census.createdLast7Days} light={light}/><Metric label="Cuentas con login en 7 días" value={census.signInsLast7Days} light={light}/></div></details>}
    </div>
    <div className={`rounded-2xl border p-5 ${card}`}>
      <h3 className="font-bold flex items-center gap-2"><BarChart3 size={19} className="text-emerald-500"/>Actividad medida · voluntaria</h3>
      <p className={`mt-1 text-xs leading-relaxed ${muted}`}>Sólo incluye cuentas que activaron “Ayudar a mejorar RosterMax”. No equivale al total anterior.</p>
      {activityState === 'error' ? <p role="alert" className="mt-3 text-sm text-amber-500">La lectura de actividad falló. Mostramos “—”, no ceros inventados.</p> : !activityReady ? <p role="status" className="mt-3 text-sm">Cargando actividad…</p> : audience.measuredUsers === 0 && <p className="mt-3 rounded-xl bg-blue-500/10 p-3 text-xs text-blue-500">Sin muestra de actividad. Puede haber usuarios e instalaciones aunque nadie haya activado las métricas.</p>}
      <div className="grid grid-cols-2 gap-2 mt-4"><Metric label="Cuentas con medición" value={measured('measuredUsers')} light={light}/><Metric label="Activas medidas · 24 h" value={measured('activeDay')} light={light}/><Metric label="Activas medidas · 7 días" value={measured('activeWeek')} light={light}/><Metric label="Activas medidas · 30 días" value={measured('activeMonth')} light={light}/></div>
      <div className="mt-3"><Metric label="Cuentas con instalación detectada" value={measured('installsDetected')} hint="Detección parcial en la muestra voluntaria. No mide dispositivos únicos, desinstalaciones ni descargas de tienda." light={light}/></div>
      <p className={`mt-3 text-xs flex gap-2 leading-relaxed ${muted}`}><ShieldCheck size={16} className="shrink-0"/>Para vender publicidad, identifica siempre la muestra y el período. No sumes cuentas invitadas como clientes ni prometas alcance no medido.</p>
    </div>
  </section>;
}
