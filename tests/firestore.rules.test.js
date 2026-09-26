import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection, deleteDoc, doc, getDoc, getDocs, runTransaction,
  serverTimestamp, setDoc, setLogLevel, Timestamp, updateDoc, writeBatch,
} from 'firebase/firestore';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const APP = 'rostermax';
const privatePath = (uid, path) => `artifacts/${APP}/users/${uid}/${path}`;
const publicPath = (path) => `artifacts/${APP}/public/data/${path}`;

describe('reglas reales de Firestore (emulador local)', { skip: !emulatorHost }, () => {
  let env;
  let alice;
  let bob;
  let admin;

  before(async () => {
    // Expected permission denials are asserted below, so SDK logging adds noise.
    setLogLevel('silent');
    const [host, rawPort] = emulatorHost.split(':');
    assert.ok(['127.0.0.1', 'localhost'].includes(host), 'Estas pruebas solo pueden borrar datos del emulador local.');
    env = await initializeTestEnvironment({
      projectId: 'demo-rostermax-security',
      firestore: { host, port: Number(rawPort), rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
    });
    alice = env.authenticatedContext('alice').firestore();
    bob = env.authenticatedContext('bob').firestore();
    // Deliberately no custom admin claim: production also supports the admin registry.
    admin = env.authenticatedContext('owner').firestore();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, `artifacts/${APP}/admins/owner`), { active: true }),
        setDoc(doc(db, publicPath('ads/campaign')), { active: true }),
      ]);
    });
  });

  after(async () => { await env?.cleanup(); });

  async function consent(db, uid, enabled = true) {
    await setDoc(doc(db, privatePath(uid, 'settings/privacy')), { analyticsEnabled: enabled, updatedAt: serverTimestamp() });
  }

  function activity(uid, changes = {}) {
    return {
      ownerUid: uid, accountType: 'google', firstSeenAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(), lastActiveDay: '2026-09-13', installDetected: false,
      rosterConfigured: true, profileComplete: true, appVersion: 'rules-test', ...changes,
    };
  }

  function campaignMetric(uid, changes = {}) {
    return {
      ownerUid: uid, campaignId: 'campaign', views: 1, clicks: 0,
      firstViewAt: serverTimestamp(), lastEventAt: serverTimestamp(), ...changes,
    };
  }

  function sharedRoster(uid, code, exceptions = []) {
    return {
      ownerUid: uid, syncCode: code, name: uid, workDays: 14, restDays: 14,
      startDate: '2026-09-01', exceptions, updatedAt: serverTimestamp(),
    };
  }

  it('rechaza lecturas privadas, administración propia y listados de otras personas', async () => {
    await setDoc(doc(alice, privatePath('alice', 'settings/profile')), { displayName: 'Ana' });
    await assertFails(getDoc(doc(bob, privatePath('alice', 'settings/profile'))));
    await assertFails(setDoc(doc(alice, `artifacts/${APP}/admins/alice`), { active: true }));
    await assertFails(getDocs(collection(alice, publicPath('activity'))));
    await assertFails(getDocs(collection(alice, publicPath('campaign_metrics'))));
    await assertFails(getDocs(collection(alice, publicPath('sync_codes'))));
    const signedOut = env.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(signedOut, publicPath('ads'))));
    await assertFails(getDoc(doc(signedOut, publicPath('campaign_metrics/campaign_alice'))));
    await assertSucceeds(getDocs(collection(admin, publicPath('activity'))));
    await assertSucceeds(getDocs(collection(admin, publicPath('campaign_metrics'))));
    await assertSucceeds(getDoc(doc(admin, `artifacts/${APP}/admins/owner`)));
  });

  it('exige consentimiento guardado y timestamps del servidor para actividad', async () => {
    const ref = doc(alice, publicPath('activity/alice'));
    await assertFails(setDoc(ref, activity('alice')));
    await consent(alice, 'alice');
    await assertFails(setDoc(ref, activity('alice', { firstSeenAt: Timestamp.fromMillis(1) })));
    await assertFails(setDoc(ref, activity('alice', { lastActiveAt: Timestamp.fromMillis(1) })));
    await assertSucceeds(setDoc(ref, activity('alice')));
    await assertFails(updateDoc(ref, { accountType: 'invented', lastActiveAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { firstSeenAt: Timestamp.fromMillis(1), lastActiveAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { lastActiveAt: serverTimestamp(), installDetected: true }));
    await assertFails(getDoc(doc(bob, publicPath('activity/alice'))));
    const revokedBatch = writeBatch(alice);
    revokedBatch.set(doc(alice, privatePath('alice', 'settings/privacy')), { analyticsEnabled: false });
    revokedBatch.update(ref, { lastActiveAt: serverTimestamp() });
    await assertFails(revokedBatch.commit());
    await consent(alice, 'alice', false);
    await assertFails(updateDoc(ref, { lastActiveAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('restringe censo agregado al CEO con esquema cerrado y fecha de servidor', async () => {
    const path = `artifacts/${APP}/admin_stats/accounts`;
    const census = {
      schemaVersion: 1, source: 'firebase-auth', projectId: 'rostermax-60242', generatedAt: serverTimestamp(),
      totalAccounts: 4, registeredAccounts: 3, guestAccounts: 1, googleAccounts: 3, disabledAccounts: 0,
      createdLast7Days: 1, createdLast30Days: 2, signInsLast24Hours: 1, signInsLast7Days: 2, signInsLast30Days: 3,
    };
    await assertSucceeds(getDoc(doc(admin, path)));
    await assertFails(getDoc(doc(alice, path)));
    await assertFails(setDoc(doc(alice, path), census));
    await assertSucceeds(setDoc(doc(admin, path), census));
    await assertSucceeds(getDoc(doc(admin, path)));
    await assertFails(getDoc(doc(alice, path)));
    await assertFails(getDocs(collection(admin, `artifacts/${APP}/admin_stats`)));
    for (const change of [
      { registeredAccounts: 2 }, { googleAccounts: 4 }, { disabledAccounts: -1 },
      { signInsLast7Days: 4 }, { createdLast7Days: 3 }, { source: 'client-guess' },
      { projectId: 'different-project' }, { identities: ['private'] }, { generatedAt: Timestamp.fromMillis(1) },
    ]) await assertFails(setDoc(doc(admin, path), { ...census, ...change }));
    await assertFails(deleteDoc(doc(admin, path)));
  });

  it('registra la primera impresión mediante una transacción que lee un documento inexistente', async () => {
    const ref = doc(alice, publicPath('campaign_metrics/campaign_alice'));
    await assertSucceeds(getDoc(ref));
    await assertFails(getDoc(doc(bob, publicPath('campaign_metrics/campaign_alice'))));
    await assertFails(setDoc(ref, campaignMetric('alice')));
    await consent(alice, 'alice');
    await assertSucceeds(runTransaction(alice, async (transaction) => {
      const snapshot = await transaction.get(ref);
      assert.equal(snapshot.exists(), false);
      transaction.set(ref, campaignMetric('alice'));
    }));
    assert.equal((await getDoc(ref)).data().views, 1);
    await assertFails(getDoc(doc(bob, publicPath('campaign_metrics/campaign_alice'))));
    await assertSucceeds(getDoc(doc(admin, publicPath('campaign_metrics/campaign_alice'))));
  });

  it('impide falsificar métricas, fechas y aumentos de más de un evento', async () => {
    await consent(alice, 'alice');
    const ref = doc(alice, publicPath('campaign_metrics/campaign_alice'));
    await assertFails(setDoc(ref, campaignMetric('alice', { views: 0 })));
    await assertFails(setDoc(ref, campaignMetric('alice', { views: 1, clicks: 1 })));
    await assertFails(setDoc(ref, campaignMetric('alice', { firstViewAt: Timestamp.fromMillis(1) })));
    await assertFails(setDoc(ref, campaignMetric('alice', { lastEventAt: Timestamp.fromMillis(1) })));
    await assertSucceeds(setDoc(ref, campaignMetric('alice')));
    await assertFails(updateDoc(ref, { views: 2, clicks: 1, lastEventAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { views: 3, lastEventAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { views: 0, lastEventAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { lastEventAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { views: 2, diagnosis: 'private', lastEventAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { views: 2, lastEventAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { clicks: 1, lastEventAt: serverTimestamp() }));
    await consent(alice, 'alice', false);
    await assertFails(updateDoc(ref, { clicks: 2, lastEventAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('no permite leer métricas ajenas cuando un UID es sufijo de otro', async () => {
    const longerUid = env.authenticatedContext('alice_bob').firestore();
    await consent(longerUid, 'alice_bob');
    await setDoc(doc(longerUid, publicPath('campaign_metrics/campaign_alice_bob')), campaignMetric('alice_bob'));
    await assertFails(getDoc(doc(bob, publicPath('campaign_metrics/campaign_alice_bob'))));
    const specialUid = env.authenticatedContext('user.with_regex+').firestore();
    await assertSucceeds(getDoc(doc(specialUid, publicPath('campaign_metrics/campaign_user.with_regex+'))));
    await assertFails(getDoc(doc(alice, publicPath('campaign_metrics/campaign_user.with_regex+'))));
  });

  it('sólo acepta disponibilidad compartida, sin motivos médicos ni notas privadas', async () => {
    const ref = doc(alice, publicPath('sync_codes/RM-AAAAAAAA'));
    const base = 'N|2026-09-13|2026-09-15';
    await assertSucceeds(setDoc(ref, sharedRoster('alice', 'RM-AAAAAAAA', [base])));
    for (const invalid of [
      'medical|2026-09-13|2026-09-15', 'N|2026-09-13|2026-09-15|Diagnóstico',
      'N|2026-13-13|2026-13-15',
      { type: 'medical', mode: 'rest', startDate: '2026-09-13', endDate: '2026-09-15' },
    ]) {
      await assertFails(setDoc(ref, sharedRoster('alice', 'RM-AAAAAAAA', [invalid])));
    }
    await assertFails(setDoc(ref, sharedRoster('alice', 'RM-AAAAAAAA', [null])));
    await assertFails(setDoc(ref, sharedRoster('alice', 'RM-AAAAAAAA', Array(31).fill(base))));
    await assertSucceeds(setDoc(ref, sharedRoster('alice', 'RM-AAAAAAAA', Array(30).fill(base))));
    const cycle = 'C|2026-09-13|2026-09-15|7|7|2026-09-13';
    await assertSucceeds(setDoc(ref, sharedRoster('alice', 'RM-AAAAAAAA', Array(30).fill(cycle))));
    await assertSucceeds(setDoc(doc(bob, publicPath('sync_codes/RM-BBBBBBBB')), sharedRoster('bob', 'RM-BBBBBBBB', Array(30).fill(cycle))));
    await assertFails(setDoc(ref, sharedRoster('alice', 'RM-AAAAAAAA', ['C|2026-09-13|2026-09-15|0|7|2026-09-13'])));
    await assertFails(setDoc(ref, sharedRoster('alice', 'RM-AAAAAAAA', ['C|2026-09-13|2026-09-15|7|366|2026-09-13'])));
    await assertFails(setDoc(doc(bob, publicPath('sync_codes/RM-AAAAAAAA')), sharedRoster('bob', 'RM-AAAAAAAA')));
  });

  it('acepta un vínculo recíproco atómico pero no sobrescribe lo editado por su destinatario', async () => {
    await setDoc(doc(alice, publicPath('sync_codes/RM-AAAAAAAA')), sharedRoster('alice', 'RM-AAAAAAAA'));
    await setDoc(doc(bob, publicPath('sync_codes/RM-BBBBBBBB')), sharedRoster('bob', 'RM-BBBBBBBB'));
    const ownRef = doc(bob, privatePath('bob', 'friends/alice'));
    const reverseRef = doc(bob, privatePath('alice', 'friends/bob'));
    const reverse = {
      name: 'Bob', friendUid: 'bob', syncCode: 'RM-BBBBBBBB', isSynced: true,
      reciprocal: true, inviteCode: 'RM-AAAAAAAA', createdAt: serverTimestamp(),
    };
    await assertSucceeds(getDoc(reverseRef));
    await assertFails(setDoc(reverseRef, reverse));
    await assertSucceeds(runTransaction(bob, async (transaction) => {
      const [own, other] = await Promise.all([transaction.get(ownRef), transaction.get(reverseRef)]);
      assert.equal(own.exists(), false);
      assert.equal(other.exists(), false);
      transaction.set(ownRef, { name: 'Alice', friendUid: 'alice', syncCode: 'RM-AAAAAAAA', isSynced: true });
      transaction.set(reverseRef, reverse);
    }));
    await updateDoc(doc(alice, privatePath('alice', 'friends/bob')), { name: 'Mi compañero' });
    await assertFails(setDoc(reverseRef, reverse));
    assert.equal((await getDoc(reverseRef)).data().name, 'Mi compañero');
    await assertFails(deleteDoc(reverseRef));
    await assertFails(getDocs(collection(bob, privatePath('alice', 'friends'))));
    const thirdParty = env.authenticatedContext('mallory').firestore();
    await assertFails(getDoc(doc(thirdParty, privatePath('alice', 'friends/bob'))));
    const batch = writeBatch(bob);
    batch.set(doc(bob, privatePath('alice', 'friends/mallory')), { ...reverse, friendUid: 'mallory' });
    await assertFails(batch.commit());
  });

  it('reacepta conexiones antiguas sin bandera recíproca pero jamás lee notas privadas añadidas', async () => {
    const reverseFromOwner = doc(alice, privatePath('alice', 'friends/bob'));
    await setDoc(reverseFromOwner, {
      name: 'Nombre elegido por Ana', friendUid: 'bob', syncCode: 'RM-BBBBBBBB', isSynced: true,
    });
    const reverseFromBob = doc(bob, privatePath('alice', 'friends/bob'));
    await assertSucceeds(runTransaction(bob, async (transaction) => {
      const reverse = await transaction.get(reverseFromBob);
      assert.equal(reverse.exists(), true);
      transaction.set(doc(bob, privatePath('bob', 'friends/alice')), {
        name: 'Alice', friendUid: 'alice', syncCode: 'RM-AAAAAAAA', isSynced: true,
      });
    }));
    assert.equal((await getDoc(reverseFromOwner)).data().name, 'Nombre elegido por Ana');
    await assertFails(updateDoc(reverseFromBob, { name: 'Sobrescrito' }));
    await updateDoc(reverseFromOwner, { privateNotes: 'Esta nota pertenece sólo a Ana' });
    await assertFails(getDoc(reverseFromBob));
    await assertSucceeds(getDoc(reverseFromOwner));
  });
});
