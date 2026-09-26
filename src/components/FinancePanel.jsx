import { useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, Check, ChevronDown, PiggyBank, Plus, Receipt, Search, Target, Trash2, WalletCards } from 'lucide-react';
import { getBudgetPlanForMonth, getExpenseCurrency, getGoalProjection, getMonthlyBudgetSummary } from '../lib/finance';
import { parseDateOnly } from '../lib/roster';
import ReminderEditor from './ReminderEditor';

const CATEGORIES = { comida: 'Comida', transporte: 'Transporte', familia: 'Familia', salud: 'Salud', hogar: 'Hogar', ocio: 'Ocio', otros: 'Otros' };
const CURRENCIES = { ARS: 'Pesos argentinos · ARS', USD: 'Dólares · USD' };

function formatMoney(value, currency) {
  const safeCurrency = /^[A-Z]{3}$/.test(currency || '') ? currency : 'ARS';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: safeCurrency, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatDate(value) {
  return parseDateOnly(value) === null ? 'Sin fecha' : new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

function readMoney(form, field, { positive = false } = {}) {
  const raw = form.get(field);
  const value = Number(raw);
  if (raw === null || String(raw).trim() === '' || !Number.isFinite(value) || value < (positive ? 0.01 : 0) || value > 1000000000000) {
    throw new Error('Revisa los montos: usa números válidos, sin separadores de miles.');
  }
  return Math.round(value * 100) / 100;
}

function Field({ label, children, hint }) {
  return <label className="block min-w-0"><span className="mb-1.5 block text-xs font-semibold">{label}</span>{children}{hint && <span className="mt-1 block text-xs opacity-70">{hint}</span>}</label>;
}

function GoalCard({ goal, styles, pending, onContribute, onDelete, theme, today }) {
  const projection = getGoalProjection(goal);
  const currency = goal.currency || 'USD';
  return <article className={`rounded-2xl border p-4 ${styles.surface}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className={`text-xs font-bold ${styles.muted}`}>{currency} · Meta de ahorro</p><h4 className="mt-1 break-words font-bold">{goal.title || 'Meta sin título'}</h4></div>
      <button type="button" disabled={Boolean(pending)} onClick={() => onDelete(goal.id)} aria-label={`Eliminar meta ${goal.title || 'sin título'}`} className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl ${styles.secondary}`}><Trash2 size={17}/></button>
    </div>
    <p className="mt-4 break-words text-xl font-black">{formatMoney(goal.current, currency)}</p>
    <p className={`mt-1 text-xs ${styles.muted}`}>de {formatMoney(goal.target, currency)}</p>
    {projection ? <>
      <div role="progressbar" aria-label={`Avance de ${goal.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(projection.progress)} className={`mt-3 h-2 overflow-hidden rounded-full ${styles.track}`}><div className="h-full rounded-full bg-emerald-500" style={{ width: `${projection.progress}%` }}/></div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs"><span className="font-bold text-emerald-500">{Math.round(projection.progress)}% logrado</span><span className={styles.muted}>Faltan {formatMoney(projection.remaining, currency)}</span></div>
      <p className={`mt-3 text-xs leading-relaxed ${styles.muted}`}>{projection.monthsRemaining === 0 ? 'Meta completada. ¡Buen trabajo!' : projection.monthsRemaining ? `Aportando ${formatMoney(projection.monthlyPlan, currency)} cada mes, alcanzarías la meta en aproximadamente ${projection.monthsRemaining} ${projection.monthsRemaining === 1 ? 'mes' : 'meses'}.` : 'Sin aporte mensual definido. Puedes registrar aportes cuando quieras.'}</p>
      {projection.remaining > 0 && <form className="mt-4 space-y-2" onSubmit={(event) => onContribute(event, goal, projection.remaining)}>
        <Field label={`Registrar aporte (${currency})`}><input name="amount" type="number" min="0.01" max={projection.remaining} step="0.01" inputMode="decimal" required disabled={Boolean(pending)} className={styles.input} placeholder="0,00"/></Field>
        <button type="submit" disabled={Boolean(pending)} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold ${styles.secondary}`}><Plus size={16}/>{pending === `goal-funds-${goal.id}` ? 'Guardando…' : 'Registrar aporte'}</button>
      </form>}
      {projection.remaining > 0 && <ReminderEditor kind="goal" item={goal} today={today} theme={theme}/>}
    </> : <p className="mt-3 text-sm text-amber-500">Esta meta tiene un monto objetivo inválido.</p>}
  </article>;
}

export default function FinancePanel({ theme = 'dark', today, config, settings = {}, expenses = [], goals = [], onSaveSettings, onAddExpense, onDeleteExpense, onCreateGoal, onAddFunds, onDeleteGoal }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const currency = selectedCurrency || settings.currency || 'ARS';
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(8);
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const pendingRef = useRef(false);
  const isLight = theme === 'light';
  const styles = {
    surface: isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800',
    muted: isLight ? 'text-slate-600' : 'text-slate-400',
    input: `min-h-11 w-full min-w-0 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/70 disabled:opacity-60 ${isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'}`,
    secondary: `border disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${isLight ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'}`,
    track: isLight ? 'bg-slate-200' : 'bg-slate-800',
  };
  const primaryButton = 'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:opacity-50';
  const summary = useMemo(() => getMonthlyBudgetSummary(settings, expenses, config, month, today, currency), [settings, expenses, config, month, today, currency]);
  const plan = getBudgetPlanForMonth(settings, month, currency, today);
  const monthName = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
  const filteredExpenses = useMemo(() => expenses.filter((expense) => parseDateOnly(expense.date) !== null && expense.date.slice(0, 7) === month && getExpenseCurrency(expense, settings) === currency && (category === 'all' || expense.category === category) && `${expense.note || ''} ${CATEGORIES[expense.category] || expense.category || ''}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))).sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id))), [expenses, month, settings, currency, category, search]);

  async function runAction(key, action, successMessage, onSuccess) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(key);
    setMessage(null);
    try {
      if (await action() === false) throw new Error('No se pudo guardar el cambio. Vuelve a intentarlo.');
      onSuccess?.();
      setMessage({ type: 'success', text: successMessage });
    } catch (error) {
      setMessage({ type: 'error', text: error?.code ? 'No se pudo guardar. Revisa tu conexión y vuelve a intentarlo.' : error?.message || 'No se pudo guardar el cambio.' });
    } finally {
      pendingRef.current = false;
      setPending('');
    }
  }

  function saveBudget(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    runAction('budget', async () => {
      const payload = { month, currency, monthlyIncome: readMoney(form, 'monthlyIncome'), fixedCosts: readMoney(form, 'fixedCosts'), plannedSavings: readMoney(form, 'plannedSavings') };
      return onSaveSettings(payload);
    }, `Presupuesto de ${monthName} guardado en ${currency}.`);
  }

  function addExpense(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    runAction('expense', async () => {
      const date = String(form.get('date'));
      if (parseDateOnly(date) === null || date > today) throw new Error('Elige la fecha en que realizaste el gasto, hasta hoy.');
      const expense = { amount: readMoney(form, 'amount', { positive: true }), currency, category: String(form.get('category') || 'otros'), date, note: String(form.get('note') || '').trim().slice(0, 80) };
      return onAddExpense(expense);
    }, `Gasto registrado en ${currency}.`, () => { element.reset(); setMonth(String(form.get('date')).slice(0, 7)); setCategory('all'); setSearch(''); setVisibleCount(8); });
  }

  function createGoal(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    runAction('goal', async () => {
      const title = String(form.get('title') || '').trim();
      if (!title) throw new Error('Escribe el nombre de tu meta.');
      return onCreateGoal({ title: title.slice(0, 80), target: readMoney(form, 'target', { positive: true }), monthlyPlan: readMoney(form, 'monthlyPlan'), currency: String(form.get('currency')), current: 0 });
    }, 'Meta creada.', () => element.reset());
  }

  function contribute(event, goal, remaining) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    runAction(`goal-funds-${goal.id}`, async () => {
      const amount = readMoney(form, 'amount', { positive: true });
      if (amount > remaining) throw new Error(`El aporte supera lo que falta: ${formatMoney(remaining, goal.currency || 'USD')}.`);
      return onAddFunds(goal, amount);
    }, 'Aporte registrado en tu meta.', () => element.reset());
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    runAction(`delete-${deleteTarget.id}`, () => deleteTarget.type === 'goal' ? onDeleteGoal(deleteTarget.id) : onDeleteExpense(deleteTarget.id), deleteTarget.type === 'goal' ? 'Meta eliminada.' : 'Gasto eliminado.', () => setDeleteTarget(null));
  }

  return <section className="space-y-5 pb-6 animate-in fade-in duration-300" aria-labelledby="finance-heading">
    <header><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500"><WalletCards size={23}/></div><div><h2 id="finance-heading" className="text-2xl font-black tracking-tight">Tu dinero, con un plan</h2><p className={`mt-1 text-sm ${styles.muted}`}>Ordena el mes y aprovecha mejor tu franco.</p></div></div></header>

    {message && <div role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${message.type === 'error' ? 'border-red-400/40 bg-red-500/10 text-red-500' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'}`}>{message.text}</div>}

    <div className={`grid grid-cols-1 gap-3 rounded-2xl border p-4 sm:grid-cols-2 ${styles.surface}`}>
      <Field label="Mes del presupuesto"><input type="month" value={month} disabled={Boolean(pending)} onChange={(event) => { if (parseDateOnly(`${event.target.value}-01`) !== null) { setMonth(event.target.value); setVisibleCount(8); } }} className={styles.input} style={{ colorScheme: theme }}/></Field>
      <Field label="Moneda"><select value={currency} disabled={Boolean(pending)} onChange={(event) => { setSelectedCurrency(event.target.value); setVisibleCount(8); }} className={styles.input}>{Object.entries(CURRENCIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <p className={`text-xs leading-relaxed sm:col-span-2 ${styles.muted}`}>Cada mes y moneda tiene su propio presupuesto. Los gastos en pesos y dólares se cuentan por separado.</p>
    </div>

    <div className="overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-950 to-slate-950 p-5 text-white">
      <p className="text-xs font-bold capitalize tracking-wide text-emerald-300">{monthName} · {currency}</p>
      <p className="mt-4 text-sm text-slate-300">{summary.remaining < 0 ? 'Falta cubrir' : 'Disponible según tu plan'}</p>
      <p className={`mt-1 break-words text-3xl font-black tracking-tight ${summary.remaining < 0 ? 'text-rose-300' : 'text-white'}`}>{formatMoney(Math.abs(summary.remaining), currency)}</p>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">{summary.income === 0 ? 'Todavía no registraste ingresos para este mes y moneda.' : summary.remaining < 0 ? 'Los gastos y el ahorro reservado superan el ingreso previsto. Ajusta tu plan para cubrir la diferencia.' : 'Ingreso menos gastos fijos, ahorro reservado y gastos registrados. No es un saldo bancario.'}</p>
      <dl className="mt-5 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <div className="rounded-2xl bg-white/5 p-3"><dt className="text-xs text-slate-300">Gastos registrados</dt><dd className="mt-1 break-words text-lg font-bold">{formatMoney(summary.variableSpent, currency)}</dd></div>
        <div className="rounded-2xl bg-white/5 p-3"><dt className="text-xs text-slate-300">Ahorro reservado</dt><dd className="mt-1 break-words text-lg font-bold">{formatMoney(summary.plannedSavings, currency)}</dd></div>
        <div className="rounded-2xl bg-white/5 p-3"><dt className="text-xs text-slate-300">Días de franco restantes</dt><dd className="mt-1 text-lg font-bold">{summary.remainingRestDays === null ? 'Configura tu roster' : `${summary.remainingRestDays} días`}</dd></div>
        <div className="rounded-2xl bg-white/5 p-3"><dt className="text-xs text-slate-300">Orientación por día de franco</dt><dd className="mt-1 break-words text-lg font-bold">{summary.dailyRestBudget === null ? 'No aplica' : formatMoney(summary.dailyRestBudget, currency)}</dd></div>
      </dl>
      <p className="mt-3 text-xs leading-relaxed text-slate-300">{month < today.slice(0, 7) ? 'Este mes ya terminó; no se calcula un importe diario futuro.' : 'El importe diario reparte el disponible entre los francos y vacaciones que quedan este mes, incluido hoy. Las licencias quedan fuera de ese cálculo. Reserva también lo que necesites durante el trabajo.'}</p>
    </div>

    <form onSubmit={saveBudget} aria-busy={pending === 'budget'} key={`${month}-${currency}-${plan.monthlyIncome}-${plan.fixedCosts}-${plan.plannedSavings}`} className={`rounded-2xl border p-5 ${styles.surface}`}><fieldset disabled={Boolean(pending)} className="min-w-0 space-y-4">
      <div><h3 className="flex items-center gap-2 font-bold"><PiggyBank size={19} className="text-emerald-500"/>Presupuesto de {monthName}</h3><p className={`mt-1 text-xs leading-relaxed ${styles.muted}`}>{plan.isLegacy ? 'Recuperamos tu presupuesto anterior. Guárdalo para asignarlo a este mes.' : plan.isSaved ? `Guardado en ${currency}. Puedes ajustar los montos.` : `Aún no hay un presupuesto guardado en ${currency} para este mes.`}</p></div>
      <Field label={`Ingreso previsto (${currency})`} hint="Sueldo, adicionales y otros ingresos que esperas recibir."><input name="monthlyIncome" type="number" min="0" max="1000000000000" step="0.01" inputMode="decimal" required defaultValue={plan.monthlyIncome} className={styles.input}/></Field>
      <div className="grid gap-3 sm:grid-cols-2"><Field label={`Gastos fijos (${currency})`} hint="Alquiler, cuotas, servicios, etc."><input name="fixedCosts" type="number" min="0" max="1000000000000" step="0.01" inputMode="decimal" required defaultValue={plan.fixedCosts} className={styles.input}/></Field><Field label={`Ahorro a reservar (${currency})`} hint="Lo apartamos del disponible, aunque aún no lo ahorraste."><input name="plannedSavings" type="number" min="0" max="1000000000000" step="0.01" inputMode="decimal" required defaultValue={plan.plannedSavings} className={styles.input}/></Field></div>
      <p className={`text-xs ${styles.muted}`}>Si ya incluiste un pago en gastos fijos, no lo registres otra vez abajo: se descontaría dos veces.</p>
      <button type="submit" disabled={Boolean(pending)} className={primaryButton}><Check size={17}/>{pending === 'budget' ? 'Guardando…' : 'Guardar este presupuesto'}</button>
    </fieldset></form>

    <section className={`rounded-2xl border p-5 ${styles.surface}`} aria-labelledby="expenses-heading">
      <h3 id="expenses-heading" className="flex items-center gap-2 font-bold"><Receipt size={19} className="text-blue-500"/>Gastos del día a día</h3>
      <form onSubmit={addExpense} aria-busy={pending === 'expense'} className="mt-4"><fieldset disabled={Boolean(pending)} className="min-w-0 space-y-3">
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2"><Field label={`Monto (${currency})`}><input name="amount" type="number" min="0.01" max="1000000000000" step="0.01" inputMode="decimal" required className={styles.input} placeholder="0,00"/></Field><Field label="Categoría"><select name="category" className={styles.input}>{Object.entries(CATEGORIES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field><Field label="Fecha del gasto"><input key={`expense-date-${month}`} name="date" type="date" max={today} defaultValue={month < today.slice(0, 7) ? `${month}-01` : today} required className={styles.input} style={{ colorScheme: theme }}/></Field><Field label="Detalle (opcional)"><input name="note" maxLength={80} className={styles.input} placeholder="Por ejemplo, pasaje a casa"/></Field></div>
        <p className={`text-xs ${styles.muted}`}>Se guardará en {currency}, en el mes de la fecha elegida.</p>
        <button type="submit" disabled={Boolean(pending)} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold ${styles.secondary}`}><ArrowDownLeft size={17}/>{pending === 'expense' ? 'Guardando…' : 'Registrar gasto'}</button>
      </fieldset></form>
      <div className="mt-6 border-t border-slate-500/20 pt-5"><h4 className="text-sm font-bold capitalize">Movimientos de {monthName}</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Buscar gasto"><div className="relative"><Search size={16} aria-hidden="true" className={`pointer-events-none absolute left-3 top-3.5 ${styles.muted}`}/><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(8); }} className={`${styles.input} pl-9`} placeholder="Detalle o categoría"/></div></Field><Field label="Filtrar categoría"><select value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(8); }} className={styles.input}><option value="all">Todas las categorías</option>{Object.entries(CATEGORIES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field></div>
        {summary.otherCurrencyExpenses > 0 && <p className={`mt-3 text-xs ${styles.muted}`}>{summary.otherCurrencyExpenses} {summary.otherCurrencyExpenses === 1 ? 'gasto está registrado' : 'gastos están registrados'} en otra moneda. Cambia la moneda arriba para verlos.</p>}
        {summary.legacyExpenseCount > 0 && <p className={`mt-3 rounded-xl p-3 text-xs leading-relaxed ${isLight ? 'bg-amber-50 text-amber-900' : 'bg-amber-500/10 text-amber-200'}`}>Los {summary.legacyExpenseCount} gastos antiguos sin moneda registrada se interpretan como {settings.legacyExpenseCurrency || settings.currency || 'ARS'}, la moneda de tu presupuesto anterior.</p>}
        {filteredExpenses.length === 0 ? <p className={`py-8 text-center text-sm ${styles.muted}`}>{summary.expenseCount ? 'No hay gastos que coincidan con esta búsqueda.' : `Todavía no hay gastos en ${currency} para este mes.`}</p> : <>
          <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1" aria-label="Gastos registrados">{filteredExpenses.slice(0, visibleCount).map((expense) => <li key={expense.id} className={`flex items-center gap-2 rounded-xl p-3 ${isLight ? 'bg-slate-50' : 'bg-slate-800/50'}`}><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{expense.note || CATEGORIES[expense.category] || 'Gasto'}</p><p className={`mt-1 text-xs ${styles.muted}`}>{formatDate(expense.date)} · {CATEGORIES[expense.category] || expense.category || 'Otros'}</p><p className="mt-1 break-words text-sm font-bold">− {formatMoney(expense.amount, getExpenseCurrency(expense, settings))}</p></div><button type="button" disabled={Boolean(pending)} onClick={() => setDeleteTarget({ type: 'expense', id: expense.id, label: `${expense.note || CATEGORIES[expense.category] || 'Gasto'} · ${formatMoney(expense.amount, getExpenseCurrency(expense, settings))}` })} aria-label={`Eliminar gasto ${expense.note || CATEGORIES[expense.category] || ''} de ${formatMoney(expense.amount, getExpenseCurrency(expense, settings))}`} className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl ${styles.secondary}`}><Trash2 size={16}/></button></li>)}</ul>
          <p className={`mt-3 text-center text-xs ${styles.muted}`}>{Math.min(visibleCount, filteredExpenses.length)} de {filteredExpenses.length} gastos</p>
          {visibleCount < filteredExpenses.length && <button type="button" onClick={() => setVisibleCount((count) => count + 12)} className={`mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold ${styles.secondary}`}>Ver más gastos<ChevronDown size={17}/></button>}
        </>}
      </div>
    </section>

    <section className="space-y-3" aria-labelledby="goals-heading">
      <div><h3 id="goals-heading" className="flex items-center gap-2 text-lg font-bold"><Target size={21} className="text-emerald-500"/>Metas que te motivan</h3><p className={`mt-1 text-xs leading-relaxed ${styles.muted}`}>Registra el dinero que ya separaste para cada meta. Los aportes son un seguimiento independiente: no descuentan gastos ni mueven dinero de tu cuenta.</p></div>
      <details className={`rounded-2xl border p-4 ${styles.surface}`}><summary className="min-h-7 cursor-pointer text-sm font-bold">Crear una meta de ahorro</summary><form onSubmit={createGoal} className="mt-4 space-y-3"><Field label="Nombre de la meta"><input name="title" required maxLength={80} className={styles.input} placeholder="Fondo de emergencia, vacaciones…"/></Field><div className="grid gap-3 min-[360px]:grid-cols-2"><Field label="Moneda de la meta"><select name="currency" defaultValue={currency} className={styles.input}>{Object.entries(CURRENCIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Monto objetivo"><input name="target" type="number" min="0.01" max="1000000000000" step="0.01" inputMode="decimal" required className={styles.input} placeholder="0,00"/></Field></div><Field label="Aporte mensual previsto" hint="Es una intención, no un aporte automático. Usa 0 si todavía no lo definiste."><input name="monthlyPlan" type="number" min="0" max="1000000000000" step="0.01" inputMode="decimal" required defaultValue={0} className={styles.input}/></Field><button type="submit" disabled={Boolean(pending)} className={primaryButton}><Plus size={17}/>{pending === 'goal' ? 'Guardando…' : 'Crear meta'}</button></form></details>
      <p className={`text-xs ${styles.muted}`}>Cada meta pendiente permite crear un recordatorio mensual en tu calendario para revisar el ahorro.</p>
      {goals.length === 0 ? <div className={`rounded-2xl border p-6 text-center ${styles.surface}`}><PiggyBank size={30} className="mx-auto text-emerald-500"/><p className="mt-3 text-sm font-bold">Dale un destino a tu esfuerzo</p><p className={`mt-1 text-xs ${styles.muted}`}>Crea tu primera meta y registra cada avance, a tu ritmo.</p></div> : <div className="grid gap-3 sm:grid-cols-2">{goals.map((goal) => <GoalCard key={goal.id} goal={goal} styles={styles} pending={pending} theme={theme} today={today} onContribute={contribute} onDelete={(id) => setDeleteTarget({ type: 'goal', id, label: goal.title || 'Meta sin título' })}/>)}</div>}
    </section>

    {deleteTarget && <div role="alertdialog" aria-modal="false" aria-labelledby="finance-delete-title" aria-describedby="finance-delete-detail" className={`sticky bottom-24 z-20 space-y-3 rounded-2xl border p-4 shadow-xl ${isLight ? 'bg-white border-rose-200' : 'bg-slate-900 border-rose-500/40'}`}><h3 id="finance-delete-title" className="font-bold">¿Eliminar {deleteTarget.type === 'goal' ? 'esta meta' : 'este gasto'}?</h3><p id="finance-delete-detail" className={`break-words text-sm ${styles.muted}`}>{deleteTarget.label}. {deleteTarget.type === 'goal' ? 'También se quitará su progreso registrado.' : 'Se quitará del resumen de ese mes.'}</p><div className="grid grid-cols-2 gap-2"><button type="button" disabled={Boolean(pending)} onClick={() => setDeleteTarget(null)} className={`min-h-11 rounded-xl text-sm font-bold ${styles.secondary}`}>Conservar</button><button type="button" disabled={Boolean(pending)} onClick={confirmDelete} className="min-h-11 rounded-xl bg-rose-600 text-sm font-bold text-white disabled:opacity-50">{pending.startsWith('delete-') ? 'Eliminando…' : 'Eliminar'}</button></div></div>}
  </section>;
}
