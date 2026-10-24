import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeFeatureEvents } from '../src/lib/featureMetrics.js';
const now = new Date('2026-10-24T12:00:00Z');
const op = (id, days, ownerUid = 'a') => ({ id, type: 'plan_saved', ownerUid, occurredAt: { seconds: now.getTime()/1000 - days*86400 } });
test('métricas usan fecha real, períodos móviles y exclusiones explícitas sin contar reintentos', () => {
  const rows = [op('one',0),op('one',0),op('two',6),op('three',29),op('old',31),op('owner',0,'owner'),op('future',-1),{ id:'bad', type:'expense_recorded' }];
  assert.equal(summarizeFeatureEvents(rows, { now, days:1 }).totals.plan_saved, 2);
  assert.equal(summarizeFeatureEvents(rows, { now, days:7 }).totals.plan_saved, 3);
  const result = summarizeFeatureEvents(rows, { now, days:30, excludedUids:['owner'] });
  assert.equal(result.totals.plan_saved, 3); assert.equal(result.accounts, 1); assert.equal(result.excluded, 1); assert.equal(result.invalid, 2);
  assert.deepEqual(summarizeFeatureEvents([], { now }).totals.plan_saved, 0);
});
