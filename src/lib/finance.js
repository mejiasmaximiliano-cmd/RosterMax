import { addDaysToDate, getStatusForDate, isRestAvailable, parseDateOnly } from './roster.js';

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 100) / 100 : 0;
}

function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getGoalProjection(goal) {
  const target = money(goal?.target);
  const current = money(goal?.current);
  const monthlyPlan = money(goal?.monthlyPlan);
  if (target <= 0) return null;
  const remaining = Math.max(0, Math.round((target - current) * 100) / 100);
  const progress = Math.min(100, (current / target) * 100);
  const monthsRemaining = remaining === 0 ? 0 : monthlyPlan > 0 ? Math.ceil(remaining / monthlyPlan) : null;
  return { remaining, progress, monthsRemaining, monthlyPlan };
}

export function getExpenseCurrency(expense, settings) {
  // Older records did not persist their currency. Freeze this fallback on first save
  // as legacyExpenseCurrency; a later display currency change must not relabel them.
  return expense?.currency || settings?.legacyExpenseCurrency || settings?.currency || 'ARS';
}

export function getBudgetPlanForMonth(settings, month, currency, today = localToday()) {
  const stored = settings?.monthlyPlans?.[month]?.[currency];
  if (stored) return { ...stored, currency, month, isSaved: true, isLegacy: false };
  const hasLegacyPlan = settings && ['monthlyIncome', 'fixedCosts', 'plannedSavings'].some((field) => Object.hasOwn(settings, field));
  const legacyCurrency = settings?.legacyExpenseCurrency || settings?.currency || 'ARS';
  // A legacy plan had no month. Offer it only for the current month until saved.
  if (!settings?.monthlyPlans && hasLegacyPlan && month === today.slice(0, 7) && currency === legacyCurrency) {
    return { monthlyIncome: money(settings.monthlyIncome), fixedCosts: money(settings.fixedCosts), plannedSavings: money(settings.plannedSavings), currency, month, isSaved: false, isLegacy: true };
  }
  return { monthlyIncome: 0, fixedCosts: 0, plannedSavings: 0, currency, month, isSaved: false, isLegacy: false };
}

export function getMonthlyBudgetSummary(settings, expenses, rosterConfig, month, today = localToday(), currency = settings?.currency || 'ARS') {
  const monthPrefix = typeof month === 'string' && /^\d{4}-\d{2}$/.test(month) && parseDateOnly(`${month}-01`) !== null ? month : today.slice(0, 7);
  const plan = getBudgetPlanForMonth(settings, monthPrefix, currency, today);
  const income = money(plan.monthlyIncome);
  const fixedCosts = money(plan.fixedCosts);
  const plannedSavings = money(plan.plannedSavings);
  const monthExpenses = (expenses || []).filter((expense) => parseDateOnly(expense.date) !== null && expense.date.slice(0, 7) === monthPrefix);
  const matchingExpenses = monthExpenses.filter((expense) => getExpenseCurrency(expense, settings) === currency);
  const variableSpent = matchingExpenses.reduce((total, expense) => total + Math.round(money(expense.amount) * 100), 0) / 100;
  const availableAfterPlan = Math.round((income - fixedCosts - plannedSavings) * 100) / 100;
  const remaining = Math.round((availableAfterPlan - variableSpent) * 100) / 100;

  let restDaysInMonth = 0;
  let remainingRestDays = 0;
  let rosterValid = true;
  for (let date = `${monthPrefix}-01`; date?.startsWith(monthPrefix); date = addDaysToDate(date, 1)) {
    const status = getStatusForDate(date, rosterConfig);
    if (status.error) { rosterValid = false; break; }
    if (isRestAvailable(status)) {
      restDaysInMonth += 1;
      if (date >= today) remainingRestDays += 1;
    }
  }
  return {
    income, fixedCosts, plannedSavings, variableSpent, availableAfterPlan, remaining,
    currency, month: monthPrefix, hasSavedPlan: plan.isSaved, isLegacyPlan: plan.isLegacy,
    restDaysInMonth: rosterValid ? restDaysInMonth : null,
    remainingRestDays: rosterValid ? remainingRestDays : null,
    dailyRestBudget: rosterValid && remainingRestDays > 0 ? Math.max(0, remaining) / remainingRestDays : null,
    savingsRate: income > 0 ? (plannedSavings / income) * 100 : null,
    otherCurrencyExpenses: monthExpenses.length - matchingExpenses.length,
    legacyExpenseCount: matchingExpenses.filter((expense) => !expense.currency).length,
    expenseCount: matchingExpenses.length,
  };
}
