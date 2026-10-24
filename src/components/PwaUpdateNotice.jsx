import { useEffect, useState } from 'react';

export default function PwaUpdateNotice({ pending, theme, showControls = true }) {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    let registration, worker;
    let disposed = false;
    const inspect = () => {
      if (disposed) return;
      setAvailable(Boolean(registration?.waiting && navigator.serviceWorker.controller));
      if (worker !== registration?.installing) {
        worker?.removeEventListener('statechange', inspect);
        worker = registration?.installing;
        worker?.addEventListener('statechange', inspect);
      }
    };
    navigator.serviceWorker.ready.then((reg) => { if (disposed) return; registration = reg; reg.addEventListener('updatefound', inspect); inspect(); }).catch(() => {});
    return () => { disposed = true; registration?.removeEventListener('updatefound', inspect); worker?.removeEventListener('statechange', inspect); };
  }, []);
  const check = async () => {
    setChecking(true);
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) setMessage('Las actualizaciones se comprueban al abrir la app instalada.');
      else { await reg.update(); setMessage('Comprobación solicitada. Si hay una versión lista, aparecerá el aviso aquí.'); }
    } catch { setMessage('No se pudo comprobar. Conservamos la versión actual y tus datos. Intenta con conexión.'); }
    finally { setChecking(false); }
  };
  if (!available && !showControls) return null;
  return <section aria-label="Actualización de RosterMax" className={`rounded-2xl border p-4 ${theme === 'light' ? 'bg-blue-50 border-blue-200' : 'bg-blue-500/10 border-blue-500/30'}`}>
    <h3 className="font-bold">{available ? 'Hay una actualización lista' : 'Versión y actualizaciones'}</h3>
    <p className="mt-2 text-xs">{available ? pending ? 'Hay cambios sin confirmar. Espera a ver “sincronizado” antes de cerrar. La app no se recargará automáticamente.' : 'Para recibirla, cierra todas las ventanas y pestañas de RosterMax (también la app instalada) y vuelve a abrirla. No borres datos ni reinstales.' : 'Las versiones completas se descargan en segundo plano y esperan a que cierres las ventanas anteriores.'}</p>
    <button type="button" disabled={checking} onClick={check} className="mt-3 min-h-11 rounded-xl border border-blue-500/40 px-3 text-sm font-semibold disabled:opacity-50">{checking ? 'Comprobando…' : 'Comprobar actualización'}</button>
    {message && <p role="status" className="mt-2 text-xs">{message}</p>}
    <p className="mt-2 text-xs opacity-75">{__APP_VERSION__} · {__BUILD_COMMIT__.slice(0, 12)}</p>
  </section>;
}
