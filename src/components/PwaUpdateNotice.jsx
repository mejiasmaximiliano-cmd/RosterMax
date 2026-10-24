import { useEffect, useRef, useState } from 'react';
import { createUpdateChecker, fetchNetworkVersion } from '../lib/updateChecker';
import { appEnvironment } from '../lib/firebase';

export default function PwaUpdateNotice({ pending, theme, showControls = true, onHelp }) {
  const [result, setResult] = useState({ status: 'idle' });
  const checker = useRef(null);
  useEffect(() => {
    const check = createUpdateChecker({ loadedCommit: __BUILD_COMMIT__, fetchVersion: () => fetchNetworkVersion(fetch, { environment: appEnvironment.environment }), getRegistration: () => navigator.serviceWorker?.getRegistration(), onState: setResult });
    checker.current = check;
    let reg, disposed = false;
    const discover = () => { if (!disposed && (reg.waiting || reg.installing)) void check.check(); };
    const attach = (value) => { if (!value || disposed || reg === value) return; reg?.removeEventListener('updatefound', discover); reg = value; reg.addEventListener('updatefound', discover); discover(); };
    navigator.serviceWorker?.getRegistration().then(attach).catch(() => {});
    navigator.serviceWorker?.ready?.then(attach).catch(() => {});
    return () => { disposed = true; check.dispose(); reg?.removeEventListener('updatefound', discover); };
  }, []);
  const titles = { idle: 'Versión y actualizaciones', checking: 'Comprobando…', latest: 'Tenés la última versión', downloading: 'Descargando actualización', ready: 'Actualización lista para activar', available: 'Hay una versión nueva', error: 'No se pudo comprobar la actualización' };
  if (!showControls && !['ready', 'downloading', 'available'].includes(result.status)) return null;
  return <section id="section-updates" aria-label="Actualización de RosterMax" className={`rounded-2xl border p-4 ${theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/30'}`}>
    <h3 aria-live="polite" className="font-bold">{titles[result.status]}</h3>
    {result.checkedAt && <p className="mt-2 text-xs">Comprobación por red: {result.checkedAt.toLocaleString('es-AR')}. {result.status === 'error' ? 'Esa comprobación anterior no confirma el estado actual.' : ''}</p>}
    <p className="mt-2 text-sm">{result.status === 'ready' ? pending ? 'Hay cambios sin confirmar. Esperá a ver “sincronizado” antes de cerrar. No recargamos automáticamente.' : 'Cerrá todas las ventanas y pestañas de RosterMax en este navegador/dispositivo, incluida la app instalada, y volvé a abrir. No borres datos ni reinstales.' : result.status === 'downloading' ? 'La descarga completa todavía no terminó. Podés seguir usando esta versión.' : result.detail || 'Comprobar consulta la versión pública por red; descargar y activar son pasos distintos. Las versiones completas esperan a que cierres las ventanas anteriores.'}</p>
    <button type="button" disabled={result.status === 'checking' || result.status === 'downloading'} onClick={() => checker.current?.check()} className="mt-3 min-h-11 rounded-xl border border-blue-500/40 px-3 text-sm font-semibold disabled:opacity-50">{result.status === 'checking' ? 'Comprobando…' : 'Comprobar actualización'}</button>
    <p className="mt-2 text-xs opacity-75">{__APP_VERSION__} · {__BUILD_COMMIT__.slice(0, 12)}</p>
    <button type="button" onClick={() => onHelp?.('updates')} className="mt-2 min-h-11 text-sm font-semibold underline">Ayuda sobre actualizaciones</button>
  </section>;
}
