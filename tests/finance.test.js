import test from 'node:test';
import assert from 'node:assert/strict';
import { getBudgetPlanForMonth, getExpenseCurrency, getGoalProjection, getMonthlyBudgetSummary } from '../src/lib/finance.js';

const roster = { workDays: 14, restDays: 14, startDate: '2026-09-01' };
const today = '2026-09-13';
const settings = {
  currency: 'ARS',
  monthlyPlans: {
    '2026-09': {
      ARS: { monthlyIncome: 2000, fixedCosts: 800, plannedSavings: 400 },
      USD: { monthlyIncome: 300, fixedCosts: 100, plannedSavings: 50 },
    },
    '2026-10': { ARS: { monthlyIncome: 2200, fixedCosts: 900, plannedSavings: 400 } },
  },
};

test('estima meses restantes según el aporte mensual', () => {
  assert.deepEqual(getGoalProjection({ target: 1000, current: 250, monthlyPlan: 200 }), {
    remaining: 750,
    progress: 25,
    monthsRemaining: 4,
    monthlyPlan: 200,
  });
});

test('tolera metas cumplidas y rechaza objetivos inválidos', () => {
  assert.equal(getGoalProjection({ target: 0 }), null);
  assert.equal(getGoalProjection({ target: 100, current: 150, monthlyPlan: 10 }).monthsRemaining, 0);
});

test('reparte el disponible entre días de franco reales restantes del mes', () => {
  const summary = getMonthlyBudgetSummary(
    settings,
    [{ amount: 150, date: '2026-09-05', currency: 'ARS' }, { amount: 50, date: '2026-08-31', currency: 'ARS' }],
    roster,
    '2026-09',
    today,
    'ARS',
  );
  assert.equal(summary.variableSpent, 150);
  assert.equal(summary.remaining, 650);
  assert.equal(summary.restDaysInMonth, 14);
  assert.equal(summary.remainingRestDays, 14);
  assert.equal(Number(summary.dailyRestBudget.toFixed(2)), 46.43);
  assert.equal(summary.savingsRate, 20);
});

test('ajusta el franco restante con vacaciones y trabajo extra, e incluye hoy', () => {
  const config = { ...roster, exceptions: [
    { type: 'vacation', mode: 'rest', startDate: '2026-09-13', endDate: '2026-09-14' },
    { type: 'extra_work', mode: 'work', startDate: '2026-09-20', endDate: '2026-09-22' },
  ] };
  const summary = getMonthlyBudgetSummary(settings, [], config, '2026-09', today);
  assert.equal(summary.remainingRestDays, 13);
  assert.equal(summary.dailyRestBudget, 800 / 13);
  assert.equal(getMonthlyBudgetSummary(settings, [], config, '2026-09', '2026-09-28').remainingRestDays, 1);
});

test('no interpreta carpeta médica ni permisos como francos disponibles para ocio', () => {
  const config = { ...roster, exceptions: [
    { type: 'medical', mode: 'rest', startDate: '2026-09-15', endDate: '2026-09-18' },
    { type: 'leave', mode: 'rest', startDate: '2026-09-20', endDate: '2026-09-21' },
    { type: 'unavailable', mode: 'rest', startDate: '2026-09-23', endDate: '2026-09-23' },
  ] };
  assert.equal(getMonthlyBudgetSummary(settings, [], config, '2026-09', today).remainingRestDays, 7);
});

test('preserva el mes y moneda de cada presupuesto sin sumar pesos y dólares', () => {
  const expenses = [
    { amount: 100, date: '2026-09-02', currency: 'ARS' },
    { amount: 20, date: '2026-09-03', currency: 'USD' },
    { amount: 300, date: '2026-10-03', currency: 'ARS' },
  ];
  const pesos = getMonthlyBudgetSummary(settings, expenses, roster, '2026-09', today, 'ARS');
  const dollars = getMonthlyBudgetSummary(settings, expenses, roster, '2026-09', today, 'USD');
  const october = getMonthlyBudgetSummary(settings, expenses, roster, '2026-10', today, 'ARS');
  assert.equal(pesos.variableSpent, 100);
  assert.equal(pesos.remaining, 700);
  assert.equal(pesos.otherCurrencyExpenses, 1);
  assert.equal(dollars.variableSpent, 20);
  assert.equal(dollars.remaining, 130);
  assert.equal(october.income, 2200);
  assert.equal(october.remaining, 600);
});

test('los gastos antiguos conservan su moneda al cambiar el presupuesto a USD', () => {
  const migrated = { ...settings, currency: 'USD', legacyExpenseCurrency: 'ARS' };
  const legacyExpense = { amount: 500, date: '2026-09-02' };
  assert.equal(getExpenseCurrency(legacyExpense, migrated), 'ARS');
  const pesos = getMonthlyBudgetSummary(migrated, [legacyExpense], roster, '2026-09', today, 'ARS');
  const dollars = getMonthlyBudgetSummary(migrated, [legacyExpense], roster, '2026-09', today, 'USD');
  assert.equal(pesos.variableSpent, 500);
  assert.equal(pesos.legacyExpenseCount, 1);
  assert.equal(dollars.variableSpent, 0);
  assert.equal(dollars.otherCurrencyExpenses, 1);
});

test('ofrece el presupuesto legacy sólo en el mes actual hasta guardarlo', () => {
  const legacy = { monthlyIncome: 1200, fixedCosts: 200, currency: 'ARS' };
  assert.equal(getBudgetPlanForMonth(legacy, '2026-09', 'ARS', today).monthlyIncome, 1200);
  assert.equal(getBudgetPlanForMonth(legacy, '2026-09', 'ARS', today).isLegacy, true);
  assert.equal(getBudgetPlanForMonth(legacy, '2026-08', 'ARS', today).monthlyIncome, 0);
  assert.equal(getBudgetPlanForMonth(legacy, '2026-09', 'USD', today).monthlyIncome, 0);
  assert.equal(getBudgetPlanForMonth({ ...legacy, monthlyPlans: settings.monthlyPlans }, '2026-11', 'ARS', today).monthlyIncome, 0);
});

test('cero ingreso y déficit permanecen visibles y no se inventa un porcentaje de ahorro', () => {
  const zeroIncome = { monthlyPlans: { '2026-09': { ARS: { monthlyIncome: 0, fixedCosts: 100, plannedSavings: 50 } } } };
  const summary = getMonthlyBudgetSummary(zeroIncome, [{ amount: 20, date: '2026-09-01', currency: 'ARS' }], roster, '2026-09', today);
  assert.equal(summary.remaining, -170);
  assert.equal(summary.dailyRestBudget, 0);
  assert.equal(summary.savingsRate, null);
});

test('un mes pasado, ningún franco pendiente o un roster inválido no fabrican días', () => {
  const past = getMonthlyBudgetSummary(settings, [], roster, '2026-08', today);
  assert.equal(past.remainingRestDays, 0);
  assert.equal(past.dailyRestBudget, null);
  const noRest = getMonthlyBudgetSummary(settings, [], roster, '2026-09', '2026-09-29');
  assert.equal(noRest.remainingRestDays, 0);
  assert.equal(noRest.dailyRestBudget, null);
  const invalid = getMonthlyBudgetSummary(settings, [], {}, '2026-09', today);
  assert.equal(invalid.remainingRestDays, null);
  assert.equal(invalid.dailyRestBudget, null);
});

test('respeta febrero bisiesto y cuenta francos de un roster especial', () => {
  const config = { workDays: 28, restDays: 1, startDate: '2028-02-01', exceptions: [{ type: 'special_roster', mode: 'cycle', startDate: '2028-02-01', endDate: '2028-02-28', cycleStartDate: '2028-02-01', workDays: 1, restDays: 1 }] };
  const summary = getMonthlyBudgetSummary({}, [], config, '2028-02', '2028-02-28');
  assert.equal(summary.restDaysInMonth, 15);
  assert.equal(summary.remainingRestDays, 2);
});

test('usa centavos y excluye fechas o importes inválidos de los totales', () => {
  const expenses = [
    { amount: 0.1, date: '2026-09-01', currency: 'ARS' },
    { amount: 0.2, date: '2026-09-02', currency: 'ARS' },
    { amount: Infinity, date: '2026-09-03', currency: 'ARS' },
    { amount: 'mal dato', date: '2026-09-04', currency: 'ARS' },
    { amount: -10, date: '2026-09-04', currency: 'ARS' },
    { amount: 1000, date: '2026-09-31', currency: 'ARS' },
  ];
  const summary = getMonthlyBudgetSummary(settings, expenses, roster, '2026-09', today);
  assert.equal(summary.variableSpent, 0.3);
  assert.equal(summary.remaining, 799.7);
  assert.equal(getGoalProjection({ target: 0.3, current: 0.1, monthlyPlan: 0.1 }).monthsRemaining, 2);
  assert.equal(getGoalProjection({ target: 100, current: 'inválido', monthlyPlan: Infinity }).remaining, 100);
});
