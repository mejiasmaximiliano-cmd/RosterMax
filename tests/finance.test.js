import test from 'node:test';
import assert from 'node:assert/strict';
import { getGoalProjection, getMonthlyBudgetSummary } from '../src/lib/finance.js';

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

test('calcula presupuesto disponible y gasto diario de franco', () => {
  const summary = getMonthlyBudgetSummary(
    { monthlyIncome: 2000, fixedCosts: 800, plannedSavings: 400 },
    [{ amount: 150, date: '2026-08-05' }, { amount: 50, date: '2026-07-31' }],
    { workDays: 14, restDays: 14 },
    '2026-08',
  );
  assert.equal(summary.variableSpent, 150);
  assert.equal(summary.remaining, 650);
  assert.equal(summary.estimatedRestDays, 15);
  assert.equal(Number(summary.dailyRestBudget.toFixed(2)), 43.33);
  assert.equal(summary.savingsRate, 20);
});
