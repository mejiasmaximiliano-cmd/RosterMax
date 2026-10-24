import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Users, ListChecks, Scale, Wallet } from 'lucide-react';
import Modal from './Modal';
import { STORIES } from '../lib/helpContent';
import { getStatusForDate } from '../lib/roster';
import { getMonthlyBudgetSummary } from '../lib/finance';

const DEMO_ROSTER = { workDays: 14, restDays: 14, startDate: '2026-10-01' };
const icons = [CalendarDays, Users, ListChecks, Scale, Wallet];
const readSeen = (key) => { try { return localStorage.getItem(key) === '1'; } catch { return false; } };

// Prepared for reviewed, same-origin recordings. No controls appear until a real
// reviewed audioSrc is supplied. Audio is requested only after an explicit tap.
function Narration({ story }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false), [error, setError] = useState('');
  useEffect(() => () => { audio.current?.pause(); if (audio.current) audio.current.src = ''; }, []);
  if (!story.audioSrc) return null;
  const listen = async (repeat = false) => {
    if (!audio.current) { audio.current = new Audio(story.audioSrc); audio.current.onended = () => setPlaying(false); audio.current.onerror = () => { setPlaying(false); setError('No se pudo descargar el audio. Podés leer la explicación completa.'); }; }
    if (playing && !repeat) { audio.current.pause(); setPlaying(false); return; }
    if (repeat) audio.current.currentTime = 0;
    try { await audio.current.play(); setPlaying(true); } catch { setError('No se pudo iniciar el audio. La explicación escrita sigue disponible.'); }
  };
  return <div><button onClick={() => listen()} className="min-h-11 underline">{playing ? 'Pausar explicación' : 'Escuchar explicación'}</button><button onClick={() => listen(true)} className="ml-3 min-h-11 underline">Repetir</button>{error && <p role="status" className="text-sm">{error}</p>}</div>;
}

function Demo({ scene, theme }) {
  const [tried, setTried] = useState(false);
  const light = theme === 'light';
  const surface = `rounded-2xl border p-4 ${light ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-700'}`;
  const action = 'mt-4 min-h-11 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white';
  const money = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
  const budget = getMonthlyBudgetSummary({ monthlyIncome: 1000000, fixedCosts: 500000, plannedSavings: 200000, currency: 'ARS' }, tried ? [{ date: '2026-10-24', amount: 10000, currency: 'ARS' }] : [], DEMO_ROSTER, '2026-10', '2026-10-24', 'ARS');
  return <div className="story-demo space-y-3" aria-label="Demostración interactiva sin guardar datos">
    {scene === 0 && <><div className={surface}><p className="mb-3 text-sm font-bold">Octubre 2026 · diagrama 14 × 14</p><div className="grid grid-cols-7 gap-1.5">{[12, 13, 14, 15, 16, 17, 18].map((day) => { const status = getStatusForDate(`2026-10-${day}`, DEMO_ROSTER); return <div key={day} className={`rounded-xl p-2 text-center ${status.isWorking ? light ? 'bg-blue-50 text-blue-900' : 'bg-blue-500/20 text-blue-100' : light ? 'bg-emerald-50 text-emerald-900' : 'bg-emerald-500/20 text-emerald-100'} ${tried && day === 15 ? 'ring-2 ring-emerald-600' : ''}`}><p className="font-black">{day}</p><p className="text-xs">{status.isWorking ? 'T' : 'F'}</p></div>; })}</div><p className="mt-3 text-sm">T: trabajo · F: franco</p><p aria-live="polite" className="mt-3 text-lg font-bold">{tried ? '15 de octubre · primer día de franco' : '14 de octubre · último día de trabajo'}</p><p className="mt-1 text-sm">Próxima bajada: 15 de octubre</p></div><button onClick={() => setTried(true)} className={action}>Ver próxima bajada · demo</button></>}
    {scene === 1 && <><div className={surface}><p className="font-bold">Vos · 14 × 14</p><p className="mt-2 text-sm">Franco: 15 al 28 de octubre</p><div className="my-4 border-t border-slate-500/20"/><p className="font-bold">Compañero · 7 × 7</p><p className="mt-2 text-sm">Franco: 15 al 21 de octubre</p></div><div aria-live="polite" className={`rounded-2xl p-4 ${light ? 'bg-emerald-50 text-emerald-900' : 'bg-emerald-500/10 text-emerald-100'}`}><p className="font-bold">{tried ? '7 días de franco en común' : 'Dos diagramas para comparar'}</p><p className="mt-1 text-sm">{tried ? '15 — 21 de octubre · ambos disponibles' : 'Disponibilidad compartida, sin motivos privados de licencia.'}</p></div><button onClick={() => setTried(true)} className={action}>Buscar coincidencia · demo</button></>}
    {scene === 2 && <><div className={surface}><p className="text-sm">Día seleccionado</p><p className="mt-2 text-2xl font-black">24 de octubre</p><p className="mt-1 text-sm">Franco · día 10 de 14</p></div><div aria-live="polite" className={surface}><p className="font-bold">{tried ? 'Mate con la familia' : 'Un lugar para tus planes'}</p><p className="mt-2 text-sm">{tried ? 'Plan de ejemplo · 24 de octubre · familia' : 'Elegí una fecha y reuní lo que querés hacer.'}</p></div><button onClick={() => setTried(true)} className={action}>Ver un plan en este día · demo</button></>}
    {scene === 3 && <><div className="grid grid-cols-2 gap-3"><div className={`rounded-2xl p-4 ${light ? 'bg-emerald-50 text-emerald-950' : 'bg-emerald-500/10 text-emerald-100'}`}><p className="text-sm font-bold">La empresa me debe</p><p aria-live="polite" className="mt-3 text-4xl font-black">{tried ? '2' : '3'}</p><p className="mt-1 text-sm">días pendientes</p></div><div className={`rounded-2xl p-4 ${light ? 'bg-amber-50 text-amber-950' : 'bg-amber-500/10 text-amber-100'}`}><p className="text-sm font-bold">Yo debo a la empresa</p><p className="mt-3 text-4xl font-black">2</p><p className="mt-1 text-sm">días pendientes</p></div></div><p aria-live="polite" className="text-sm">{tried ? 'Empresa debía 3 − disfrutaste 1 = quedan 2. El otro saldo no cambió.' : 'Dos saldos distintos. No se compensan entre sí.'}</p><button onClick={() => setTried(true)} className={action}>Tomar 1 día a favor · demo</button><p className="text-sm font-semibold">Tu calendario queda idéntico.</p></>}
    {scene === 4 && <><div className={surface}><p className="text-sm font-bold">Presupuesto de ejemplo · ARS</p><dl className="mt-3 space-y-2 text-sm"><div className="flex justify-between gap-2"><dt>Ingreso previsto</dt><dd>{money(1000000)}</dd></div><div className="flex justify-between gap-2"><dt>Gastos fijos</dt><dd>{money(500000)}</dd></div><div className="flex justify-between gap-2"><dt>Ahorro reservado</dt><dd>{money(200000)}</dd></div><div className="flex justify-between gap-2"><dt>Gasto registrado</dt><dd>{money(tried ? 10000 : 0)}</dd></div></dl></div><div aria-live="polite" className={`rounded-2xl p-4 ${light ? 'bg-emerald-50 text-emerald-950' : 'bg-emerald-500/10 text-emerald-100'}`}><p className="text-sm">Disponible estimado</p><p className="mt-1 text-3xl font-black">{money(budget.remaining)}</p><p className="mt-2 text-sm">No es tu saldo bancario.</p></div><button onClick={() => setTried(true)} className={action}>Anotar gasto de $10.000 · demo</button></>}
  </div>;
}

export default function WelcomeStories({ theme, storageKey, isNew, forceOpen, hasRoster, hasInvitation, onFinish, onExisting, onDismiss }) {
  const [seen, setSeen] = useState(() => readSeen(storageKey));
  const [open, setOpen] = useState(() => forceOpen || (isNew && !readSeen(storageKey)));
  const [scene, setScene] = useState(0);
  const heading = useRef(null);
  useEffect(() => { if (scene > 0) heading.current?.focus({ preventScroll: true }); }, [scene]);
  useEffect(() => { if (open) { try { localStorage.setItem(storageKey, '1'); } catch { /* no data writes */ } } }, [open, storageKey]);
  const close = () => { try { localStorage.setItem(storageKey, '1'); } catch { /* stay usable */ } setSeen(true); setOpen(false); onDismiss?.(); };
  const next = () => { if (scene < 4) { setScene(scene + 1); } else { close(); onFinish(); } };
  const Icon = icons[scene];
  const controls = <div className="mx-auto max-w-lg space-y-2">      <div className="grid grid-cols-[auto_1fr] gap-3"><button disabled={scene === 0} onClick={() => setScene(scene - 1)} className="min-h-11 rounded-xl border border-slate-400/40 px-4 text-sm font-semibold disabled:opacity-50">Anterior</button><button onClick={next} className="min-h-11 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">{scene < 4 ? 'Siguiente' : hasInvitation && hasRoster ? 'Ver invitación' : hasRoster ? 'Ir a mi calendario' : 'Configurar mi diagrama'}</button></div>
      {onExisting && <button onClick={() => { close(); onExisting(); }} className="min-h-11 w-full rounded-xl border border-blue-500/40 px-4 text-sm font-bold">Ya tengo cuenta</button>}</div>;
  if (!open) return !seen ? <aside className={`rounded-2xl border p-4 ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`}><p className="text-sm">Una recorrida breve, sin cambiar tus datos.</p><div className="mt-2 flex flex-wrap gap-3"><button onClick={() => setOpen(true)} className={`min-h-11 font-bold ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-300'}`}>Conocé RosterMax</button><button onClick={close} className="min-h-11 text-sm underline">Ahora no</button></div></aside> : null;
  return <Modal footer={controls} title="Conocé RosterMax" theme={theme} onClose={close} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); if (scene < 4) setScene(scene + 1); } if (event.key === 'ArrowLeft') { event.preventDefault(); setScene(Math.max(0, scene - 1)); } }}>
    <div className="mx-auto max-w-lg space-y-5">
      <div className="flex items-center justify-between gap-3"><p role="status" aria-live="polite" className="text-sm font-bold">Historia {scene + 1} de 5</p><button onClick={close} className="min-h-11 px-2 text-sm underline">Omitir presentación</button></div>
      <div aria-hidden="true" className="grid grid-cols-5 gap-2">{STORIES.map((story, i) => <div key={story.id} className={`h-1.5 rounded-full ${i <= scene ? 'bg-emerald-600' : 'bg-slate-400/30'}`}/>)}</div>
      <div key={scene} className="story-scene space-y-5"><div><Icon className={theme === 'light' ? 'text-emerald-700' : 'text-emerald-300'} size={28}/><h3 ref={heading} tabIndex={-1} className="mt-3 text-3xl sm:text-4xl font-black leading-tight">{STORIES[scene].title}</h3><p className="mt-3 text-base leading-relaxed">{STORIES[scene].text}</p></div><p className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${theme === 'light' ? 'bg-blue-50 text-blue-900' : 'bg-blue-500/15 text-blue-100'}`}>Demostración · datos ficticios · no se guarda nada</p><Demo scene={scene} theme={theme}/><Narration story={STORIES[scene]}/></div>
      <p className="text-xs opacity-75">Esta presentación explica la app. Solo el asistente de configuración o tus formularios guardan cambios.</p>
    </div>
  </Modal>;
}
