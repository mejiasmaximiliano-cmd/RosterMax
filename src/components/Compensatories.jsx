import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Scale } from 'lucide-react';
import Modal from './Modal';
import { useCompensatories } from '../lib/useCompensatories';
import { COMPENSATORY_DIRECTIONS, COMPENSATORY_KINDS, compensatoryBalances, formatCompensatoryDays } from '../lib/compensatories';
import { buildCompensatoryCsv, debtStatus, localInformativeDate } from '../lib/compensatoryCsv';

const makeDraft = (today, extra = {}) => ({ id: crypto.randomUUID(), kind: 'open', direction: 'company_owes', informativeDate: today, quantity: '', note: '', ...extra });

export default function Compensatories({ user, theme, today, onConfirmed, onPendingChange }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => makeDraft(today));
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { debts, entries, state, historyState, error, outbox, busy, submit, discardFailed } = useCompensatories(user, { open, onConfirmed });
  const pending = outbox.length > 0 || debts.some((debt) => debt.pending);
  useEffect(() => { onPendingChange?.(pending); }, [pending, onPendingChange]);
  const completeHistory = debts.every((debt) => entries.filter((entry) => entry.debtId === debt.id).length === debt.revision);
  const canExport = historyState !== 'loading' && historyState !== 'error' && completeHistory;
  const exportCsv = () => {
    if (!canExport) return;
    const url = URL.createObjectURL(new Blob([buildCompensatoryCsv({ debts, entries, confirmed: state === 'ready' && historyState === 'ready' })], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `rostermax-compensatorios-${today}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const balances = useMemo(() => compensatoryBalances(debts), [debts]);
  const light = theme === 'light';
  const card = `rounded-2xl border p-4 ${light ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'}`;
  const input = `mt-1 min-h-11 w-full min-w-0 rounded-xl border px-3 py-2 ${light ? 'bg-slate-50 border-slate-300' : 'bg-slate-950 border-slate-700'}`;
  const button = 'min-h-11 rounded-xl border border-blue-500/30 px-3 py-2 text-sm font-semibold text-blue-500 disabled:opacity-50';
  const start = (extra = {}) => { setDraft(makeDraft(today, extra)); setShowForm(true); };
  const save = async (event) => {
    event.preventDefault();
    if (await submit({ ...draft, debtId: draft.debtId || draft.id })) { setShowForm(false); setDraft(makeDraft(today)); }
  };
  const known = state === 'ready' || debts.length > 0;
  const balanceCards = <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">{Object.entries(COMPENSATORY_DIRECTIONS).map(([direction, label]) => <div key={direction} className={`rounded-xl p-3 ${direction === 'company_owes' ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-2xl font-black">{known ? formatCompensatoryDays(balances[direction]) : '—'} <span className="text-sm font-normal">días</span></p></div>)}</div>;
  return <>
    <section aria-label="Mis compensatorios" className={card}>
      <h3 className="mb-3 flex items-center gap-2 font-bold"><Scale size={20} className="text-indigo-500"/>Compensatorios personales</h3>
      {balanceCards}
      <p className="mt-3 text-sm opacity-75">Tu registro de días pendientes, separado de tu calendario. Sólo tú puedes consultarlo.</p>
      {(outbox.some((item) => item.status === 'queued') || debts.some((item) => item.pending)) && <p role="status" className="mt-2 text-sm text-amber-500">Guardado local · pendiente de confirmación del servidor</p>}
      <button type="button" onClick={() => setOpen(true)} className={`${button} mt-3 flex w-full items-center justify-center gap-2`}>Ver historial y registrar<ArrowRight size={16}/></button>
    </section>
    {open && <Modal title="Compensatorios" theme={theme} onClose={() => setOpen(false)}>
      <fieldset disabled={busy} className="space-y-5 min-w-0">
        <p className="text-sm leading-relaxed opacity-80">Anota lo que la empresa te debe y lo que tú debes por separado. La fecha es informativa. Estos movimientos no cambian tu roster, finanzas, avisos ni calendarios exportados.</p>
        {balanceCards}
        <button type="button" disabled={!canExport} onClick={exportCsv} className={button}>Exportar registro completo en CSV</button>
        <p className="text-xs opacity-75">Incluye ambos saldos y todas las revisiones, sin aplicar los filtros. Solo las filas DEUDA aportan al saldo; el historial no se suma. {canExport ? 'Registro disponible para exportar.' : 'Esperando el historial completo para evitar una exportación incompleta.'}</p>
        {state === 'loading' && <p role="status">Esperando datos del servidor o una copia local disponible…</p>}
        {state === 'cached' && <p role="status" className="text-sm text-amber-500">Copia local. La confirmación del servidor puede estar pendiente.</p>}
        {error && <p role="alert" className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-500">{error}</p>}
        {outbox.length > 0 && <div className={card}><h3 className="font-bold">Estado de tus intentos</h3>{outbox.map((item) => <div key={item.id} className="mt-3 border-t border-slate-500/20 pt-3 text-sm"><p>{COMPENSATORY_KINDS[item.kind]} · {item.status === 'error' ? 'Necesita revisión; no confirmado' : 'Guardado en este dispositivo; pendiente del servidor'}</p>{item.status === 'error' && <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => { setDraft(item); setShowForm(true); }}>Revisar y reintentar</button><button type="button" className={button} onClick={() => discardFailed(item.id)}>Descartar intento no confirmado</button></div>}</div>)}</div>}
        <button type="button" className={`${button} w-full bg-blue-500/10`} onClick={() => start()}>Registrar días pendientes</button>
        {showForm && <form onSubmit={save} className={`${card} space-y-3`}>
          <h3 className="font-bold">{COMPENSATORY_KINDS[draft.kind]}</h3>
          {draft.kind === 'open' && <label className="block text-sm font-semibold">Quién debe estos días<select value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value })} className={input}>{Object.entries(COMPENSATORY_DIRECTIONS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
          {!['void', 'void_settlement'].includes(draft.kind) && <label className="block text-sm font-semibold">Cantidad de días<input type="number" min="0.5" max="10000" step="0.5" required inputMode="decimal" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} className={input}/><span className="mt-1 block text-xs opacity-70">Días enteros o medios días. No convertimos horas a días.</span></label>}
          <label className="block text-sm font-semibold">Fecha informativa<input type="date" required value={draft.informativeDate} onChange={(event) => setDraft({ ...draft, informativeDate: event.target.value })} className={input} style={{ colorScheme: theme }}/></label>
          <label className="block text-sm font-semibold">Observación personal (opcional)<textarea maxLength={500} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} className={input}/></label>
          {draft.kind.startsWith('void') && <p className="text-sm text-amber-500">La anulación se conservará en el historial; no se borra el registro original.</p>}
          <div className="flex gap-2"><button type="submit" disabled={busy} className="min-h-11 flex-1 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar movimiento'}</button><button type="button" className={button} onClick={() => setShowForm(false)}>Cancelar</button></div>
        </form>}
        <label className="block text-sm font-semibold">Ver saldos<select value={filter} onChange={(event) => setFilter(event.target.value)} className={input}><option value="all">Ambos saldos</option>{Object.entries(COMPENSATORY_DIRECTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block text-sm font-semibold">Estado del registro<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={input}><option value="all">Todos, incluido el historial</option><option value="pending">Pendientes</option><option value="settled">Saldados</option><option value="voided">Anulados</option></select></label>
        {known && debts.length === 0 && <p className="py-5 text-center text-sm opacity-75">Aún no registraste compensatorios. Cada saldo comenzará con los días que tú cargues.</p>}
        {debts.filter((debt) => (filter === 'all' || debt.direction === filter) && (statusFilter === 'all' || debtStatus(debt) === statusFilter)).map((debt) => <article key={debt.id} aria-label={`${COMPENSATORY_DIRECTIONS[debt.direction]} del ${debt.informativeDate}`} className={`${card} space-y-3`}>
          <h3 className="font-bold">{COMPENSATORY_DIRECTIONS[debt.direction]}</h3>
          <p className="text-sm">{localInformativeDate(debt.informativeDate)} · {debt.voided ? 'Anulada' : `${formatCompensatoryDays(debt.totalUnits - debt.settledUnits)} días pendientes`}</p>
          <p className="text-xs opacity-75">{debt.pending ? 'Guardado en el dispositivo · pendiente de sincronizar' : state === 'ready' ? 'Sincronizado' : 'Guardado en el dispositivo · sin comprobación reciente'}</p>
          <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Ver detalles y registrar movimientos</summary><div className="space-y-3 pt-2">
          <p className="text-sm opacity-75">Registrados {formatCompensatoryDays(debt.totalUnits)} · compensados {formatCompensatoryDays(debt.settledUnits)}</p>
          {debt.note && <p className="break-words text-sm">{debt.note}</p>}
          <p className={`text-xs ${debt.pending ? 'text-amber-500' : 'text-emerald-500'}`}>{debt.pending ? 'Guardado local · pendiente de confirmación' : state === 'ready' ? 'Confirmado por servidor' : 'Copia local del último registro'}</p>
          {!debt.voided && <div className="flex flex-wrap gap-2">{debt.totalUnits > debt.settledUnits && <button type="button" className={button} onClick={() => start({ kind: 'settle', debtId: debt.id })}>{debt.direction === 'company_owes' ? 'Registrar disfrute' : 'Registrar compensación'}</button>}<button type="button" className={button} onClick={() => start({ kind: 'edit', debtId: debt.id, quantity: debt.totalUnits / 2, informativeDate: debt.informativeDate, note: debt.note })}>Corregir deuda</button><button type="button" disabled={debt.settledUnits > 0} className={button} onClick={() => start({ kind: 'void', debtId: debt.id })}>Anular deuda</button></div>}
          {debt.settledUnits > 0 && <p className="text-xs opacity-70">Para anular esta deuda, anula primero sus compensaciones activas.</p>}
          {Object.entries(debt.settlements || {}).map(([referenceId, units]) => <div key={referenceId} className="rounded-xl bg-blue-500/5 p-3"><p className="text-sm">Compensación activa: {formatCompensatoryDays(units)} días</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => start({ kind: 'edit_settlement', debtId: debt.id, referenceId, quantity: units / 2 })}>Corregir compensación</button><button type="button" className={button} onClick={() => start({ kind: 'void_settlement', debtId: debt.id, referenceId })}>Anular compensación</button></div></div>)}
          <details><summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold">Movimientos y correcciones</summary><ol className="space-y-2">{entries.filter((entry) => entry.debtId === debt.id).map((entry) => <li key={entry.id} className="border-l-2 border-indigo-500/40 pl-3 text-sm"><p className="font-semibold">{COMPENSATORY_KINDS[entry.kind]} · revisión {entry.revision}</p><p>{localInformativeDate(entry.informativeDate)} · {formatCompensatoryDays(entry.units)} días{entry.previousUnits > 0 ? ` · antes ${formatCompensatoryDays(entry.previousUnits)}` : ''}</p>{entry.note && <p className="break-words opacity-75">{entry.note}</p>}<p className="text-xs opacity-70">{entry.pending ? 'Pendiente de sincronizar' : historyState === 'ready' ? 'Sincronizado · registro conservado' : 'Guardado en el dispositivo'}</p></li>)}</ol></details>
          </div></details>
        </article>)}
      </fieldset>
    </Modal>}
  </>;
}
