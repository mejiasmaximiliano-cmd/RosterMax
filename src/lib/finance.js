export function getGoalProjection(goal) {
  const target = Number(goal?.target);
  const current = Number(goal?.current || 0);
  const monthlyPlan = Number(goal?.monthlyPlan || 0);

  if (!Number.isFinite(target) || target <= 0) return null;

  const remaining = Math.max(0, target - Math.max(0, current));
  const progress = Math.min(100, (Math.max(0, current) / target) * 100);
  const monthsRemaining = remaining === 0
    ? 0
    : monthlyPlan > 0 ? Math.ceil(remaining / monthlyPlan) : null;

  return { remaining, progress, monthsRemaining, monthlyPlan };
}

export function getMonthlyBudgetSummary(settings, expenses, rosterConfig, month) {
  const income = Math.max(0, Number(settings?.monthlyIncome || 0));
  const fixedCosts = Math.max(0, Number(settings?.fixedCosts || 0));
  const plannedSavings = Math.max(0, Number(settings?.plannedSavings || 0));
  const monthPrefix = /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const variableSpent = (expenses || [])
    .filter((expense) => String(expense.date || '').startsWith(monthPrefix))
    .reduce((total, expense) => total + Math.max(0, Number(expense.amount || 0)), 0);
  const availableAfterPlan = income - fixedCosts - plannedSavings;
  const remaining = availableAfterPlan - variableSpent;
  const workDays = Math.max(1, Number(rosterConfig?.workDays || 14));
  const restDays = Math.max(1, Number(rosterConfig?.restDays || 14));
  const estimatedRestDays = Math.max(1, Math.round((restDays / (workDays + restDays)) * 30));
  const dailyRestBudget = Math.max(0, remaining) / estimatedRestDays;
  const savingsRate = income > 0 ? Math.min(100, (plannedSavings / income) * 100) : 0;

  return { income, fixedCosts, plannedSavings, variableSpent, availableAfterPlan, remaining, estimatedRestDays, dailyRestBudget, savingsRate };
}
