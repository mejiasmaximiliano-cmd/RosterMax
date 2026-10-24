import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, setLogLevel } from 'firebase/firestore';
import { buildCompensatoryChange } from '../src/lib/compensatories.js';

const hostSpec = process.env.FIRESTORE_EMULATOR_HOST;
describe('compensatorios: aislamiento y validación reales', { skip: !hostSpec }, () => {
  let env, alice, bob, admin;
  const path = (uid, collection, id) => `artifacts/test/users/${uid}/${collection}/${id}`;
  before(async () => {
    const [host, port] = hostSpec.split(':');
    assert.ok(['127.0.0.1', 'localhost'].includes(host));
    setLogLevel('silent');
    env = await initializeTestEnvironment({ projectId: 'demo-rostermax-compensatories', firestore: { host, port: Number(port), rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } });
    alice = env.authenticatedContext('alice').firestore();
    bob = env.authenticatedContext('bob').firestore();
    admin = env.authenticatedContext('owner', { admin: true }).firestore();
  });
  beforeEach(() => env.clearFirestore());
  after(() => env?.cleanup());
  function operation(db, input, mutate = (change) => change) {
    const change = mutate(buildCompensatoryChange({ informativeDate: '2026-10-24', ...input }));
    const batch = writeBatch(db);
    const ref = doc(db, path('alice', 'compensatory_debts', input.debtId));
    if (input.kind === 'open') batch.set(ref, { ...change.head, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    else batch.update(ref, { ...change.head, updatedAt: serverTimestamp() });
    batch.set(doc(db, path('alice', 'compensatory_entries', input.id)), { ...change.event, createdAt: serverTimestamp() });
    return batch.commit();
  }
  const read = async (id = 'debt') => (await getDoc(doc(alice, path('alice', 'compensatory_debts', id)))).data();
  const open = (id = 'debt', direction = 'company_owes', quantity = 3) => operation(alice, { id, debtId: id, kind: 'open', direction, quantity });

  it('mantiene separados ambos saldos y acepta compensaciones parciales exactas', async () => {
    await assertSucceeds(open());
    await assertSucceeds(open('other', 'worker_owes', 2));
    await assertSucceeds(operation(alice, { id: 'use', debtId: 'debt', debt: await read(), kind: 'settle', quantity: 1 }));
    await assertSucceeds(operation(alice, { id: 'pay', debtId: 'other', debt: await read('other'), kind: 'settle', quantity: 0.5 }));
    assert.equal((await read()).totalUnits - (await read()).settledUnits, 4);
    assert.equal((await read('other')).totalUnits - (await read('other')).settledUnits, 3);
  });
  it('deniega contenido privado incluso al CEO y entradas sin su deuda atómica', async () => {
    await open();
    for (const db of [bob, admin, env.unauthenticatedContext().firestore()]) {
      await assertFails(getDoc(doc(db, path('alice', 'compensatory_debts', 'debt'))));
      await assertFails(getDoc(doc(db, path('alice', 'compensatory_entries', 'debt'))));
      await assertFails(setDoc(doc(db, path('alice', 'compensatory_debts', 'debt')), {}));
    }
    const { event } = buildCompensatoryChange({ id: 'fake', debtId: 'debt', debt: await read(), kind: 'settle', quantity: 1, informativeDate: '2026-10-24' });
    await assertFails(setDoc(doc(alice, path('alice', 'compensatory_entries', 'fake')), { ...event, createdAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(alice, path('alice', 'compensatory_debts', 'debt')), { totalUnits: 500, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(alice, path('alice', 'compensatory_debts', 'debt'))));
    await assertFails(updateDoc(doc(alice, path('alice', 'compensatory_entries', 'debt')), { units: 1 }));
  });
  it('rechaza fracciones, sobrecompensación, dirección alterada y revisiones simultáneas', async () => {
    await open();
    const debt = await read();
    const input = { id: 'use', debtId: 'debt', debt, kind: 'settle', quantity: 1 };
    for (const change of [
      { settledUnits: 7, settlements: { use: 7 } }, { settledUnits: 0.5, settlements: { use: 0.5 } },
      { direction: 'worker_owes' }, { totalUnits: -1 },
    ]) await assertFails(operation(alice, input, ({ head, event }) => ({ head: { ...head, ...change }, event })));
    await assertSucceeds(operation(alice, input));
    await assertFails(operation(alice, { ...input, id: 'stale' }));
    await assertFails(operation(alice, input)); // stable operation ID cannot apply twice
    assert.equal((await read()).settledUnits, 2);
  });
  it('corrige y anula asignaciones enlazadas sin borrar trazabilidad', async () => {
    await open();
    await operation(alice, { id: 'use', debtId: 'debt', debt: await read(), kind: 'settle', quantity: 1 });
    await assertSucceeds(operation(alice, { id: 'edit', debtId: 'debt', debt: await read(), kind: 'edit_settlement', referenceId: 'use', quantity: 0.5 }));
    assert.equal((await read()).settlements.use, 1);
    await assertSucceeds(operation(alice, { id: 'reverse', debtId: 'debt', debt: await read(), kind: 'void_settlement', referenceId: 'use' }));
    assert.deepEqual((await read()).settlements, {});
    await assertSucceeds(operation(alice, { id: 'void', debtId: 'debt', debt: await read(), kind: 'void' }));
    assert.equal((await read()).voided, true);
    assert.equal((await getDoc(doc(alice, path('alice', 'compensatory_entries', 'use')))).data().units, 2);
  });
});
