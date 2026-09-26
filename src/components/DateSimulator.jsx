import { Search, Share2, User, Zap } from 'lucide-react';
import { addDaysToDate, getStatusForDate, isRestAvailable } from '../lib/roster.js';
import { describeRosterDay } from '../lib/simulator.js';

export default function DateSimulator({ theme, today, date, onDateChange, ownStatus, friends = [] }) {
  const light = theme === 'light';
  const muted = light ? 'text-slate-600' : 'text-slate-400';
  const card = light ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800';
  const renderDay = (name, status, { self = false, synced = false, unavailable = false, id }) => {
    const description = describeRosterDay(unavailable ? null : status);
    const coincidence = !self && !unavailable && isRestAvailable(ownStatus) && isRestAvailable(status);
    const working = !unavailable && !status?.error && status?.isWorking;
    const tone = coincidence ? 'border-emerald-500/50 bg-emerald-500/10' : light ? 'border-slate-200 bg-slate-50' : 'border-slate-700 bg-slate-800/40';
    return <article key={id} aria-label={`Roster de ${name}`} className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-start justify-between gap-3"><p className="text-sm font-bold break-words min-w-0 flex items-center gap-1.5">{self && <User size={14} className="shrink-0"/>}{name}{synced && <Share2 size={12} className="shrink-0 text-blue-500" aria-label="Sincronizado"/>}</p><span className={`text-xs font-bold shrink-0 ${working ? 'text-amber-500' : 'text-emerald-500'}`}>{unavailable ? 'Sin datos sincronizados' : description.label}</span></div>
      <p className={`mt-2 text-sm ${muted}`}>{description.detail}</p>
      {description.progress !== null && <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${light ? 'bg-slate-200' : 'bg-slate-700'}`} aria-hidden="true"><div className={`h-full rounded-full ${working ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${description.progress}%` }}/></div>}
      {coincidence && <p className="mt-2 text-xs font-bold text-emerald-500 flex items-center gap-1"><Zap size={13}/>¡COINCIDEN!</p>}
    </article>;
  };
  return <section aria-label="Simulador de fechas" className={`rounded-2xl border border-l-4 border-l-blue-500 p-5 ${card}`}>
    <h3 className="font-bold flex items-center gap-2"><Search size={18} className="text-blue-500"/>Simulador de fechas</h3>
    <p className={`text-xs mt-1 mb-3 ${muted}`}>Compara la disponibilidad y el día exacto del ciclo de cada compañero.</p>
    <label className="block text-xs font-semibold">Fecha para comparar rosters<input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} className={`mt-1 min-h-11 w-full min-w-0 rounded-xl border px-3 ${light ? 'bg-slate-50 border-slate-300' : 'bg-slate-950 border-slate-700'}`} style={{ colorScheme: light ? 'light' : 'dark' }}/></label>
    <div className="flex gap-2 mt-2 mb-4">{[[today, 'Hoy'], [addDaysToDate(today, 7), 'En 7 días']].map(([value, label]) => <button key={label} type="button" onClick={() => onDateChange(value)} className="min-h-10 rounded-lg border border-blue-500/30 px-3 text-xs font-semibold text-blue-500">{label}</button>)}</div>
    {date && <div className="space-y-2 max-h-[30rem] overflow-y-auto pr-1">
      {renderDay('Tú', ownStatus, { self: true, id: 'self' })}
      {friends.map((friend) => renderDay(friend.name || 'Compañero', getStatusForDate(date, friend), { id: friend.id, synced: friend.isSynced, unavailable: friend.syncAvailable === false }))}
    </div>}
  </section>;
}
