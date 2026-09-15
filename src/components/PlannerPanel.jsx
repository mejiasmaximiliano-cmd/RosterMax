import { useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarDays, CalendarPlus, Check, ChevronDown, Clock, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { getRestPlanSummary, getTaskSummary, getUpcomingRestWindows, sortTasks, TASK_CATEGORIES, validateTask } from '../lib/planning.js';
import { getStatusForDate, isRestAvailable, parseDateOnly } from '../lib/roster.js';

const PRIORITIES = { high: 'Alta', medium: 'Media', low: 'Baja' };

function formatDate(value) {
  return parseDateOnly(value) === null ? 'Sin fecha' : new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(parseDateOnly(value)));
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} h${remainder ? ` ${remainder} min` : ''}` : `${minutes} min`;
}

function dayAvailability(date, config) {
  const status = getStatusForDate(date, config);
  if (status.error) return { kind: 'unknown', label: 'Sin fecha o roster válido', message: 'Elige una fecha para consultar tu disponibilidad.' };
  if (status.isWorking) return { kind: 'work', label: 'Día de trabajo', message: 'Ese día trabajas. Puedes guardar el plan si encaja con tu turno o elegir un franco.' };
  if (!isRestAvailable(status)) return { kind: 'leave', label: status.exceptionType === 'medical' ? 'Carpeta médica' : 'Licencia / no disponible', message: 'Este día no se cuenta como franco. Puedes guardar citas, controles u otros pendientes igualmente.' };
  return { kind: 'rest', label: status.exceptionType === 'vacation' ? 'Vacaciones' : 'Día de franco', message: 'Este día está disponible según tu roster.' };
}

function Field({ label, children }) {
  return <label className="block min-w-0"><span className="block text-xs font-semibold mb-1.5">{label}</span>{children}</label>;
}

function PlannerContent({ theme = 'dark', today, config, tasks = [], initialDate, onSaveTask, onToggleTask, onDeleteTask }) {
  const windows = useMemo(() => getUpcomingRestWindows(today, config), [today, config]);
  const nextRest = windows[0] || null;
  const nextSummary = useMemo(() => getRestPlanSummary(tasks, nextRest, today), [tasks, nextRest, today]);
  const summary = useMemo(() => getTaskSummary(tasks, today), [tasks, today]);
  const makeDraft = (date) => ({ title: '', date: date || nextRest?.startDate || today, category: 'personal', priority: 'medium', estimatedMinutes: 30, completed: false });
  const [draft, setDraft] = useState(() => makeDraft(initialDate));
  const [showForm, setShowForm] = useState(Boolean(initialDate));
  const [filter, setFilter] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);
  const [message, setMessage] = useState(null);
  const [pending, setPending] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const pendingRef = useRef(false);
  const formRef = useRef(null);
  const titleRef = useRef(null);
  const light = theme === 'light';
  const card = light ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800';
  const muted = light ? 'text-slate-600' : 'text-slate-400';
  const input = `min-h-11 w-full min-w-0 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${light ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'}`;
  const secondary = `min-h-11 rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${light ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`;
  const primary = 'min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500';
  const selectedDay = dayAvailability(draft.date, config);
  const filteredTasks = useMemo(() => sortTasks(tasks).filter((task) => {
    const overdue = !task.completed && task.date && task.date < today;
    const inNextRest = nextRest && task.date >= nextRest.startDate && task.date <= nextRest.endDate;
    const matchesFilter = filter === 'all' || (filter === 'upcoming' && !task.completed && !overdue)
      || (filter === 'overdue' && overdue) || (filter === 'done' && task.completed)
      || (filter === 'rest' && inNextRest && !task.completed);
    return matchesFilter && `${task.title || ''} ${TASK_CATEGORIES[task.category] || ''}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'));
  }), [tasks, today, nextRest, filter, search]);

  const updateDraft = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const chooseFilter = (value) => { setFilter(value); setVisibleCount(8); };
  const focusForm = () => requestAnimationFrame(() => {
    formRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    titleRef.current?.focus({ preventScroll: true });
  });
  const newPlan = (date) => {
    setDraft(makeDraft(date));
    setShowForm(true);
    setMessage(null);
    focusForm();
  };
  const editPlan = (task) => {
    setDraft({ ...makeDraft(task.date || today), ...task, date: task.date || today });
    setShowForm(true);
    setMessage(null);
    focusForm();
  };
  const runAction = async (key, action, success, afterSuccess) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(key);
    setMessage(null);
    try {
      if (await action() === false) throw new Error('No se pudo guardar. Revisa tu conexión y vuelve a intentarlo.');
      setMessage({ type: 'success', text: success });
      afterSuccess?.();
    } catch (error) {
      setMessage({ type: 'error', text: error?.code ? 'No se pudo guardar. Revisa tu conexión y vuelve a intentarlo.' : error?.message || 'No se pudo guardar el cambio.' });
    } finally {
      pendingRef.current = false;
      setPending('');
    }
  };
  const savePlan = (event) => {
    event.preventDefault();
    const validation = validateTask(draft);
    if (!validation.valid) { setMessage({ type: 'error', text: validation.error }); return; }
    runAction('save', () => onSaveTask(validation.task), draft.id ? 'Plan actualizado.' : 'Plan guardado.', () => {
      setShowForm(false);
      chooseFilter(validation.task.completed ? 'done' : validation.task.date < today ? 'overdue' : 'upcoming');
    });
  };
  const reschedule = (task) => {
    if (!nextRest) return;
    runAction(`reschedule-${task.id}`, () => onSaveTask({ ...task, date: nextRest.startDate }), `Plan reprogramado al ${formatDate(nextRest.startDate)}.`, () => chooseFilter('rest'));
  };

  return <div className="space-y-5 animate-in fade-in duration-500">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-2xl font-black">Tu tiempo de franco</h2><p className={`text-xs mt-1 ${muted}`}>Haz espacio para lo que quieres resolver y disfrutar.</p></div><button type="button" onClick={() => newPlan()} disabled={Boolean(pending)} className={`${primary} flex shrink-0 items-center gap-1.5`}><Plus size={17}/><span>Nuevo plan</span></button></div>
    <section className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
      <h3 className="text-sm font-bold flex gap-2 items-center"><CalendarDays size={18} className="text-emerald-500"/>{nextRest?.startDate === today ? 'Tu franco actual' : 'Tu próximo franco'}</h3>
      {nextRest ? <><p className="text-xl font-black mt-3">{formatDate(nextRest.startDate)} — {formatDate(nextRest.endDate)}</p><p className={`text-xs mt-1 ${muted}`}>{nextRest.days} {nextRest.days === 1 ? 'día disponible' : 'días disponibles'}{nextRest.startDate === today ? ' desde hoy' : ''}{nextRest.continuesBeyondHorizon ? ' dentro del período consultado' : ''}.</p><div className="grid grid-cols-2 gap-3 mt-4"><div className={`p-3 rounded-xl ${light ? 'bg-emerald-50' : 'bg-emerald-500/10'}`}><p className="text-xl font-black text-emerald-500">{nextSummary.open}</p><p className={`text-xs ${muted}`}>planes pendientes en este franco</p></div><div className={`p-3 rounded-xl ${light ? 'bg-blue-50' : 'bg-blue-500/10'}`}><p className="text-xl font-black text-blue-500">{formatDuration(nextSummary.minutesPending)}</p><p className={`text-xs ${muted}`}>reservadas para esos planes</p></div></div><button type="button" onClick={() => chooseFilter('rest')} className={`mt-3 w-full ${secondary}`}>Ver planes de este franco</button></> : <p className={`text-sm mt-3 ${muted}`}>No encontramos días de franco disponibles en los próximos 366 días. Revisa tu roster; puedes guardar planes en cualquier fecha.</p>}
      {windows.length > 1 && <div className={`mt-4 pt-3 border-t ${light ? 'border-slate-100' : 'border-slate-800'}`}><p className={`text-xs mb-2 ${muted}`}>Planifica también los siguientes francos</p><div className="flex flex-wrap gap-2">{windows.slice(1).map((window) => <button key={window.startDate} type="button" onClick={() => newPlan(window.startDate)} className={secondary}><CalendarPlus size={13} className="inline mr-1.5"/>{formatDate(window.startDate)} · {window.days} días</button>)}</div></div>}
    </section>
    {summary.overdue > 0 && <div className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${light ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'}`}><div className="text-xs leading-relaxed"><p className="font-bold flex items-center gap-1.5"><AlertCircle size={15}/>{summary.overdue} {summary.overdue === 1 ? 'plan quedó pendiente' : 'planes quedaron pendientes'}</p><p className="mt-1">Puedes cambiar la fecha o pasarlos al próximo franco.</p></div><button type="button" onClick={() => chooseFilter('overdue')} className="min-h-11 px-3 text-xs font-bold underline shrink-0">Revisar</button></div>}
    {message && <p role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${message.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-500' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'}`}>{message.text}</p>}
    {showForm && <form ref={formRef} onSubmit={savePlan} className={`scroll-mt-24 rounded-2xl border p-4 sm:p-5 space-y-4 ${card}`}>
      <div className="flex items-center justify-between gap-2"><h3 className="font-bold">{draft.id ? 'Editar plan' : 'Nuevo plan'}</h3><button type="button" onClick={() => setShowForm(false)} disabled={Boolean(pending)} aria-label="Cerrar formulario" className="min-h-11 min-w-11 flex items-center justify-center rounded-xl hover:bg-slate-500/10"><X size={18}/></button></div>
      <Field label="¿Qué quieres hacer?"><input ref={titleRef} value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} maxLength={140} required className={input} placeholder="Ej.: llevar a los chicos al parque"/></Field>
      <Field label="Fecha del plan"><input type="date" value={draft.date} onChange={(event) => updateDraft('date', event.target.value)} required className={input} style={{ colorScheme: light ? 'light' : 'dark' }}/></Field>
      <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${selectedDay.kind === 'rest' ? light ? 'bg-emerald-50 text-emerald-800' : 'bg-emerald-500/10 text-emerald-200' : light ? 'bg-amber-50 text-amber-900' : 'bg-amber-500/10 text-amber-200'}`}><p className="font-bold">{selectedDay.label}</p><p className="mt-1">{selectedDay.message}</p></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Categoría"><select value={draft.category} onChange={(event) => updateDraft('category', event.target.value)} className={input}>{Object.entries(TASK_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Prioridad"><select value={draft.priority} onChange={(event) => updateDraft('priority', event.target.value)} className={input}>{Object.entries(PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field></div>
      <Field label="Duración estimada (minutos)"><input type="number" inputMode="numeric" min="0" max="1440" step="1" value={draft.estimatedMinutes} onChange={(event) => updateDraft('estimatedMinutes', event.target.value)} className={input}/></Field><p className={`text-xs ${muted}`}>Usa 0 si todavía no sabes cuánto tiempo necesitas.</p>
      <button type="submit" disabled={Boolean(pending)} className={`${primary} w-full`}>{pending === 'save' ? 'Guardando…' : draft.id ? 'Guardar cambios' : 'Guardar plan'}</button>
    </form>}
    <section className={`rounded-2xl border p-4 sm:p-5 ${card}`}>
      <h3 className="font-bold mb-3">Mis planes</h3>
      <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Filtrar planes">{[['upcoming', 'Próximos'], ['rest', 'Este franco'], ['overdue', `Atrasadas${summary.overdue ? ` (${summary.overdue})` : ''}`], ['done', 'Completados'], ['all', 'Todos']].map(([value, label]) => <button key={value} type="button" onClick={() => chooseFilter(value)} aria-pressed={filter === value} className={`min-h-11 px-3 rounded-xl text-xs font-bold whitespace-nowrap border ${filter === value ? 'bg-emerald-600 text-white border-emerald-600' : light ? 'border-slate-200' : 'border-slate-700'}`}>{label}</button>)}</div>
      {tasks.length > 5 && <label className="block mt-3"><span className={`block text-xs font-semibold mb-1.5 ${muted}`}>Buscar plan</span><span className="relative block"><Search size={16} className={`absolute left-3 top-3.5 ${muted}`}/><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(8); }} className={`${input} pl-9`} placeholder="Nombre o categoría"/></span></label>}
      <p className={`text-xs mt-3 mb-3 ${muted}`}>{filteredTasks.length} {filteredTasks.length === 1 ? 'plan' : 'planes'} en esta vista</p>
      {filteredTasks.length ? <div className="space-y-3 max-h-[38rem] overflow-y-auto pr-1">{filteredTasks.slice(0, visibleCount).map((task) => {
        const availability = dayAvailability(task.date, config);
        const overdue = !task.completed && task.date && task.date < today;
        return <article key={task.id} className={`rounded-xl border p-3 ${light ? 'border-slate-200' : 'border-slate-700'} ${task.completed ? 'opacity-70' : ''}`}>
          <div className="flex gap-2 items-start"><button type="button" onClick={() => runAction(`toggle-${task.id}`, () => onToggleTask(task), task.completed ? 'Plan marcado como pendiente.' : 'Plan completado.')} disabled={Boolean(pending)} aria-label={task.completed ? `Marcar pendiente: ${task.title}` : `Completar: ${task.title}`} aria-pressed={Boolean(task.completed)} className="min-h-11 min-w-11 flex shrink-0 items-center justify-center rounded-xl hover:bg-emerald-500/10 disabled:opacity-50"><span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${task.completed ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-400'}`}>{task.completed && <Check size={16}/>}</span></button><div className="min-w-0 flex-1 pt-2"><p className={`text-sm font-bold break-words ${task.completed ? 'line-through' : ''}`}>{task.title}</p><div className={`flex flex-wrap gap-x-3 gap-y-1 text-[11px] mt-2 ${muted}`}><span className={overdue ? 'text-amber-500 font-bold' : ''}>{formatDate(task.date)}{overdue ? ' · pendiente' : ''}</span><span>{TASK_CATEGORIES[task.category] || 'Personal'}</span>{Number(task.estimatedMinutes) > 0 && <span><Clock size={11} className="inline mr-1"/>{formatDuration(Number(task.estimatedMinutes))}</span>}</div><p className={`text-[11px] mt-1 ${availability.kind === 'work' || availability.kind === 'leave' ? 'text-amber-500' : muted}`}>{availability.label}{task.priority === 'high' ? ' · Prioridad alta' : ''}</p></div></div>
          <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => editPlan(task)} disabled={Boolean(pending)} className={secondary} aria-label={`Editar: ${task.title}`}><Pencil size={13} className="inline mr-1.5"/>Editar</button>{!task.completed && nextRest && task.date !== nextRest.startDate && <button type="button" onClick={() => reschedule(task)} disabled={Boolean(pending)} className={secondary} aria-label={`Pasar al próximo franco: ${task.title}`}><RefreshCw size={13} className="inline mr-1.5"/>Al próximo franco</button>}<button type="button" onClick={() => setDeleteTarget(task.id)} disabled={Boolean(pending)} className="min-h-11 min-w-11 ml-auto flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500" aria-label={`Eliminar: ${task.title}`}><Trash2 size={16}/></button></div>
          {deleteTarget === task.id && <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3"><p className="text-xs">¿Eliminar este plan?</p><div className="flex gap-2 mt-2"><button type="button" disabled={Boolean(pending)} onClick={() => runAction(`delete-${task.id}`, () => onDeleteTask(task.id), 'Plan eliminado.', () => setDeleteTarget(null))} className="min-h-11 px-3 rounded-xl text-xs font-bold bg-red-600 text-white">Eliminar</button><button type="button" disabled={Boolean(pending)} onClick={() => setDeleteTarget(null)} className={secondary}>Conservar</button></div></div>}
        </article>;
      })}</div> : <div className={`rounded-xl px-4 py-6 text-center ${light ? 'bg-slate-50' : 'bg-slate-800/50'}`}><CalendarPlus size={25} className="mx-auto text-emerald-500 mb-2"/><p className={`text-sm ${muted}`}>{filter === 'overdue' ? 'No tienes planes atrasados.' : filter === 'done' ? 'Aquí aparecerán tus planes completados.' : 'No hay planes en esta vista.'}</p><button type="button" onClick={() => newPlan()} className="min-h-11 mt-2 text-sm font-bold text-emerald-500">Crear un plan</button></div>}
      {filteredTasks.length > visibleCount && <button type="button" onClick={() => setVisibleCount((count) => count + 8)} className={`mt-3 w-full ${secondary}`}><ChevronDown size={14} className="inline mr-1"/>Ver más ({filteredTasks.length - visibleCount})</button>}
    </section>
  </div>;
}

// Choosing a different day in the roster starts a fresh draft for that day.
export default function PlannerPanel(props) {
  return <PlannerContent key={props.initialDate || 'planner'} {...props}/>;
}
