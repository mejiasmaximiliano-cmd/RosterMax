import test from 'node:test';
import assert from 'node:assert/strict';
import { getGoalProjection } from '../src/lib/finance.js';

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
