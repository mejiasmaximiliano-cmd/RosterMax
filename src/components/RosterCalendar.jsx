import { useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, Check, ChevronLeft, ChevronRight, Download, Settings2 } from 'lucide-react';
import { buildMonthCalendar, createRosterIcs, getMonthBounds, shiftMonth } from '../lib/calendar.js';
import { parseDateOnly } from '../lib/roster.js';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function formatDate(date, options) {
  return new Intl.DateTimeFormat('es-AR', { ...options, timeZone: 'UTC' }).format(new Date(parseDateOnly(date)));
}

export default function RosterCalendar({ config, today, theme, tasks = [], onPlanDate, onManageExceptions }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [exportMessage, setExportMessage] = useState('');
  const calendar = useMemo(() => buildMonthCalendar(month, config, tasks), [month, config, tasks]);
  const selected = calendar.days.find((day) => day.date === selectedDate) || calendar.days[0];
  const light = theme === 'light';
  const card = light ? 'bg-white border-slate-200' : 'bg-slate-900/70 border-slate-800';
  const muted = light ? 'text-slate-500' : 'text-slate-400';
  const colors = light
    ? { work: 'bg-blue-50 text-blue-800 border-blue-100', rest: 'bg-emerald-50 text-emerald-800 border-emerald-100', leave: 'bg-amber-50 text-amber-800 border-amber-100' }
    : { work: 'bg-blue-500/15 text-blue-200 border-blue-500/20', rest: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20', leave: 'bg-amber-500/15 text-amber-200 border-amber-500/20' };
  const navigate = (direction) => {
    const nextMonth = shiftMonth(month, direction);
    setMonth(nextMonth);
    setSelectedDate(`${nextMonth}-01`);
    setExportMessage('');
  };
  const returnToToday = () => {
    setMonth(today.slice(0, 7));
    setSelectedDate(today);
    setExportMessage('');
  };
  const exportCalendar = (period) => {
    const bounds = getMonthBounds(month);
    const startDate = period === 'month' ? bounds.firstDate : today;
    const days = period === 'month' ? bounds.days : 90;
    try {
      const contents = createRosterIcs({ config, startDate, days });
      const url = URL.createObjectURL(new Blob([contents], { type: 'text/calendar;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `rostermax-${period === 'month' ? month : `${today}-90-dias`}.ics`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportMessage('Archivo preparado. Ábrelo o impórtalo en tu calendario.');
    } catch (error) {
      setExportMessage(error.message || 'No se pudo preparar el calendario.');
    }
  };

  return (
    <section className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${card}`} aria-label="Calendario de roster">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div><h3 className="font-bold flex items-center gap-2"><CalendarDays size={19} className="text-blue-500"/> Tu calendario</h3><p className={`text-xs mt-1 ${muted}`}>Toca un día para ver tu roster y tus planes.</p></div>
        <button type="button" onClick={returnToToday} className={`min-h-10 px-3 rounded-xl border text-xs font-bold ${light ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-700 hover:bg-slate-800'}`}>Hoy</button>
      </div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Mes anterior" className="p-3 rounded-xl hover:bg-blue-500/10"><ChevronLeft size={20}/></button>
        <p className="font-black capitalize text-sm" aria-live="polite">{formatDate(`${month}-01`, { month: 'long', year: 'numeric' })}</p>
        <button type="button" onClick={() => navigate(1)} aria-label="Mes siguiente" className="p-3 rounded-xl hover:bg-blue-500/10"><ChevronRight size={20}/></button>
      </div>
      {calendar.error ? <p role="status" className="text-sm text-amber-500">Configura tu roster para ver el calendario.</p> : <>
        <div className={`grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold mb-2 ${muted}`} aria-hidden="true">{WEEKDAYS.map((day, index) => <span key={index}>{day}</span>)}</div>
        <div className="grid grid-cols-7 gap-1.5">
          {calendar.cells.map((day, index) => day ? (
            <button
              key={day.date} type="button" onClick={() => setSelectedDate(day.date)}
              aria-label={`${formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${day.label}${day.date === today ? ', hoy' : ''}${day.tasks.length ? `, ${day.tasks.length} planes` : ''}`}
              aria-pressed={selected?.date === day.date} aria-current={day.date === today ? 'date' : undefined}
              className={`relative min-h-12 sm:min-h-14 rounded-xl border flex flex-col items-center justify-center transition-shadow ${colors[day.kind] || ''} ${selected?.date === day.date ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-transparent' : ''} ${day.date === today ? 'font-black underline underline-offset-4 decoration-2' : 'font-semibold'}`}
            >
              <span className="text-sm">{day.day}</span>
              <span className="text-[8px] uppercase font-bold no-underline leading-3">{day.kind === 'work' ? 'T' : day.kind === 'rest' ? 'F' : 'L'}</span>
              {day.tasks.length > 0 && <span aria-hidden="true" className="absolute top-1 right-1.5 w-1 h-1 rounded-full bg-current"/>}
            </button>
          ) : <span key={`empty-${index}`} aria-hidden="true"/>)}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[['work', 'Trabajo'], ['rest', 'Franco'], ['leave', 'Licencia / vac.']].map(([kind, label]) => <div key={kind} className={`rounded-xl border px-2 py-2 text-center ${colors[kind]}`}><p className="text-lg font-black">{calendar.summary[kind]}</p><p className="text-[9px] font-semibold">{label}</p></div>)}
        </div>
        {selected && <div className={`mt-4 pt-4 border-t ${light ? 'border-slate-100' : 'border-slate-800'}`}>
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0"><p className={`text-[10px] capitalize ${muted}`}>{formatDate(selected.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p><p className="font-bold text-sm mt-1 break-words">{selected.label}</p><p className={`text-xs mt-1 ${muted}`}>Día {selected.status.actualDay} de {selected.status.totalPhaseDays}{selected.kind === 'work' ? ' de trabajo' : selected.kind === 'rest' ? ' de franco' : ' de este cambio'}</p></div>
            <button type="button" onClick={() => onPlanDate?.(selected.date)} className="min-h-10 px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 flex-shrink-0"><CalendarPlus size={15}/> Planificar</button>
          </div>
          {selected.status.exceptionType === 'medical' && <p className={`mt-2 text-xs ${muted}`}>Este día es de recuperación; no se cuenta como franco para planes con tu equipo.</p>}
          {selected.tasks.length > 0 ? <ul className="mt-3 space-y-2 max-h-40 overflow-y-auto">{selected.tasks.map((task, index) => <li key={task.id || index} className={`text-xs flex gap-2 items-start ${task.completed ? `line-through ${muted}` : ''}`}><span className={`mt-0.5 rounded border w-3.5 h-3.5 flex-shrink-0 ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-400'}`}>{task.completed && <Check size={12}/>}</span><span className="break-words min-w-0">{task.title}</span></li>)}</ul> : <p className={`mt-3 text-xs ${muted}`}>No tienes planes guardados para este día.</p>}
          <button type="button" onClick={() => onManageExceptions?.()} className="min-h-10 mt-2 text-xs font-semibold text-blue-500 flex items-center gap-1.5"><Settings2 size={14}/> Registrar vacaciones o un cambio de turno</button>
        </div>}
        <details className={`mt-3 pt-3 border-t ${light ? 'border-slate-100' : 'border-slate-800'}`}>
          <summary className="text-xs font-semibold cursor-pointer py-2"><Download size={14} className="inline mr-1.5"/> Llevar mi roster a otro calendario</summary>
          <p className={`text-[11px] leading-relaxed mt-2 ${muted}`}>Descarga un archivo para Google Calendar, Apple u Outlook. Incluye trabajo, franco y ausencias sin motivos privados. Es una copia: si cambias el roster, debes volver a exportarlo.</p>
          <div className="grid grid-cols-2 gap-2 mt-3">{[['month', 'Este mes'], ['90days', 'Próximos 90 días']].map(([period, label]) => <button key={period} type="button" onClick={() => exportCalendar(period)} className={`min-h-10 px-2 rounded-xl border text-xs font-bold ${light ? 'border-slate-200 hover:bg-slate-50' : 'border-slate-700 hover:bg-slate-800'}`}>{label} <Download size={12} className="inline ml-1"/></button>)}</div>
          <p className={`text-[11px] mt-2 ${muted}`} role="status">{exportMessage}</p>
        </details>
      </>}
    </section>
  );
}
