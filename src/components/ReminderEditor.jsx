import { useId, useState } from 'react';
import { Bell, CalendarPlus, Download, ExternalLink } from 'lucide-react';
import { createGoalGoogleCalendarUrl, createGoalReminderIcs, createPlanGoogleCalendarUrl, createPlanReminderIcs } from '../lib/calendarReminders.js';
import { getLocalDate, parseDateOnly } from '../lib/roster.js';

const LEAD_OPTIONS = [[0, 'A la hora elegida'], [5, '5 minutos antes'], [15, '15 minutos antes'], [30, '30 minutos antes'], [60, '1 hora antes'], [1440, '1 día antes'], [10080, '1 semana antes']];

export default function ReminderEditor({ kind = 'plan', item, today = getLocalDate(), theme = 'dark' }) {
  const descriptionId = useId();
  const [initial] = useState(() => {
    const chosenDate = kind === 'plan' && parseDateOnly(item?.date) !== null && item.date >= today ? item.date : today;
    if (chosenDate > today) return { date: chosenDate, time: '09:00' };
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    soon.setMinutes(0, 0, 0);
    return { date: getLocalDate(soon), time: `${String(soon.getHours()).padStart(2, '0')}:00` };
  });
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [reminderMinutes, setReminderMinutes] = useState(kind === 'goal' ? 0 : 15);
  const [monthly, setMonthly] = useState(kind === 'goal');
  const [includeTitle, setIncludeTitle] = useState(false);
  const [message, setMessage] = useState(null);
  const [googleUrl, setGoogleUrl] = useState('');
  const light = theme === 'light';
  const input = `mt-1.5 min-h-11 w-full min-w-0 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${light ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'}`;
  const muted = light ? 'text-slate-600' : 'text-slate-400';
  const monthDay = parseDateOnly(date) === null ? null : Number(date.slice(-2));
  const isGoal = kind === 'goal';

  function exportReminder(event) {
    event.preventDefault();
    setMessage(null);
    setGoogleUrl('');
    try {
      const now = new Date();
      const currentDate = getLocalDate(now);
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (date < currentDate || (date === currentDate && time <= currentTime)) throw new Error('Elige una fecha y hora futuras para que el calendario pueda avisarte.');
      const localStart = new Date(`${date}T${time}:00`).getTime();
      if (Number.isFinite(localStart) && localStart - reminderMinutes * 60000 <= now.getTime()) throw new Error('El aviso anticipado ya habría pasado. Reduce la anticipación o elige una fecha posterior.');
      const options = { date, time, reminderMinutes, monthly, includeTitle, generatedAt: now };
      if (event.nativeEvent.submitter?.value === 'google') {
        const url = isGoal ? createGoalGoogleCalendarUrl({ ...options, goal: item }) : createPlanGoogleCalendarUrl({ ...options, plan: item });
        setGoogleUrl(url);
        window.open(url, '_blank', 'noopener,noreferrer');
        setMessage({ type: 'success', text: 'En Google Calendar, revisa fecha, hora y repetición, añade la notificación elegida y pulsa Guardar. RosterMax no puede confirmar que el evento o el aviso se hayan activado.' });
        return;
      }
      const contents = isGoal ? createGoalReminderIcs({ ...options, goal: item }) : createPlanReminderIcs({ ...options, plan: item });
      const url = URL.createObjectURL(new Blob([contents], { type: 'text/calendar;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rostermax-${isGoal ? 'ahorro' : 'plan'}-${date}.ics`;
      document.body.appendChild(anchor);
      try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setMessage({ type: 'success', text: 'Archivo preparado. Ábrelo en tu calendario, confirma la importación y revisa que el aviso esté activado. La descarga por sí sola no activa una alarma.' });
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'No se pudo preparar el recordatorio.' });
    }
  }

  return <details className={`mt-3 rounded-xl border p-3 ${light ? 'border-blue-200 bg-blue-50/50' : 'border-blue-500/25 bg-blue-500/5'}`}>
    <summary className="min-h-8 cursor-pointer text-sm font-bold"><Bell size={16} className="mr-2 inline text-blue-500"/>Recordatorio en mi calendario</summary>
    <form onSubmit={exportReminder} className="mt-3 space-y-3" aria-describedby={descriptionId} onChange={() => setGoogleUrl('')}>
      <p id={descriptionId} className={`text-xs leading-relaxed ${muted}`}>Prepara un evento para Google Calendar o descarga un archivo para otro calendario. {isGoal ? 'Te recordará revisar tu ahorro; tú decides y registras cada aporte.' : 'Te recordará consultar este plan.'}</p>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
        <label className="block min-w-0 text-xs font-semibold">{monthly ? 'Primer recordatorio' : 'Fecha del recordatorio'}<input type="date" required min={today} value={date} onChange={(event) => { setDate(event.target.value); setMessage(null); }} className={input} style={{ colorScheme: light ? 'light' : 'dark' }}/></label>
        <label className="block min-w-0 text-xs font-semibold">Hora local del calendario<input type="time" required value={time} onChange={(event) => { setTime(event.target.value); setMessage(null); }} className={input} style={{ colorScheme: light ? 'light' : 'dark' }}/></label>
      </div>
      <label className="block text-xs font-semibold">Avisarme<select value={reminderMinutes} onChange={(event) => { setReminderMinutes(Number(event.target.value)); setMessage(null); }} className={input}>{LEAD_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={monthly} onChange={(event) => { setMonthly(event.target.checked); setMessage(null); }} className="h-5 w-5 accent-blue-600"/><span>Repetir cada mes</span></label>
      {monthly && monthDay && <p className={`text-xs ${muted}`}>Se repetirá el día {monthDay} de cada mes{monthDay > 28 ? '; en meses más cortos, el último día disponible' : ''}. La repetición continúa hasta que la quites del calendario.</p>}
      <label className="flex min-h-11 items-center gap-3 text-xs leading-relaxed"><input type="checkbox" checked={includeTitle} onChange={(event) => { setIncludeTitle(event.target.checked); setMessage(null); }} className="h-5 w-5 shrink-0 accent-blue-600"/><span>Incluir el nombre {isGoal ? 'de la meta' : 'del plan'} en el evento y su aviso</span></label>
      <p className={`text-xs leading-relaxed ${muted}`}>{includeTitle ? 'Ese nombre será visible en tu calendario y podría aparecer en la pantalla bloqueada.' : `El evento se llamará “RosterMax: revisar mi ${isGoal ? 'ahorro' : 'plan'}”.`}{isGoal ? ' Los montos y saldos no se incluyen.' : ''}</p>
      {!isGoal && item?.date && item.date !== date && <p className={`text-xs ${muted}`}>La fecha del plan en RosterMax sigue siendo {item.date}; aquí sólo eliges cuándo recordarlo.</p>}
      <div className={`rounded-xl p-3 text-xs leading-relaxed ${light ? 'bg-white text-slate-700' : 'bg-slate-900 text-slate-300'}`}><CalendarPlus size={16} className="mr-1.5 inline text-blue-500"/>La hora usa la zona local de tu calendario o dispositivo. Revisa la hora y los permisos de avisos al importar. Si cambias el plan, completas la meta o quieres cancelar el aviso, modifica el evento en tu calendario. Las importaciones repetidas pueden crear duplicados.</div>
      <button type="submit" value="google" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"><ExternalLink size={16}/>Abrir en Google Calendar</button>
      <p className={`text-xs leading-relaxed ${muted}`}>En Google Calendar tendrás que guardar el evento y añadir o confirmar su notificación. La anticipación elegida se incluye como instrucción; el enlace no activa la alarma automáticamente.</p>
      <button type="submit" value="ics" className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${light ? 'border-blue-300 text-blue-700' : 'border-blue-500/40 text-blue-300'}`}><Download size={16}/>Descargar recordatorio (.ics)</button>
      {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-xs leading-relaxed ${message.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-500' : light ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>{message.text}</p>}
      {googleUrl && <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-blue-500 underline">Si no se abrió, entrar a Google Calendar<ExternalLink size={13}/></a>}
    </form>
  </details>;
}
