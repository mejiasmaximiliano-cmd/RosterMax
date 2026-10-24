import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateChecker, fetchNetworkVersion } from '../src/lib/updateChecker.js';
import { filterMeasuredAccounts } from '../src/lib/audienceCoverage.js';
import { FAQ_GROUPS, STORIES } from '../src/lib/helpContent.js';
import { summarizeFeatureEvents } from '../src/lib/featureMetrics.js';
import { createVersionHandler } from '../api/version.js';
import { welcomeState } from '../src/lib/welcomeState.js';

const manifest = { version: 'beta-0.8', commit: 'a'.repeat(40), build: 'b'.repeat(20), environment: 'production' };
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
test('welcome waits for account/configuration knowledge; existing and legacy-dismissed users never auto-open', () => {
  const cold = { anonymous: true, themeKnown: true, onboardingKnown: true };
  assert.deepEqual(welcomeState(cold), { ready:false, automatic:false });
  const fresh = { ...cold, rosterConfirmed:true, profileConfirmed:true };
  assert.deepEqual(welcomeState(fresh), { ready:true, automatic:true });
  for (const field of ['rosterSaved','profileStored','completed','legacyDismissed']) assert.equal(welcomeState({ ...fresh, [field]:true }).automatic,false);
  assert.equal(welcomeState({ ...fresh, anonymous:false }).automatic,false);
  assert.equal(welcomeState({ ...fresh, themeKnown:false }).ready,false);
});
class Worker extends EventTarget { state = 'installing'; }
class Registration extends EventTarget { installing = null; waiting = null; active = null; async update() {} }
test('network manifest uses no-store and cache busting; rejects stale, malformed, wrong environment and failures', async () => {
  let request;
  const fetcher = async (url, options) => { request = { url, options }; return new Response(JSON.stringify({ ...manifest, checkedNonce: new URL(url, 'http://localhost').searchParams.get('check'), checkedAt: new Date().toISOString() }), { headers: { 'content-type': 'application/json' } }); };
  assert.equal((await fetchNetworkVersion(fetcher)).commit, manifest.commit);
  assert.match(request.url, /^\/api\/version\?check=/); assert.equal(request.options.cache, 'no-store');
  for (const response of [new Response('{}', { headers: { 'content-type': 'text/html' } }), new Response(JSON.stringify(manifest), { headers: { 'content-type': 'application/json', age: '10' } }), new Response(JSON.stringify({ ...manifest, environment: 'emulator' }), { headers: { 'content-type': 'application/json' } }), new Response('', { status: 503 })]) await assert.rejects(fetchNetworkVersion(async () => response));
});
test('public version handler is read-only, emits no-store headers, per-request nonce/time and fails closed', async () => {
  let reads = 0;
  const handler = createVersionHandler({ readManifest: async () => { reads++; return JSON.stringify(manifest); }, now: () => new Date('2026-10-24T12:00:00Z') });
  const res = () => ({ headers: {}, setHeader(k,v) { this.headers[k] = v; }, end(body) { this.body = JSON.parse(body); } });
  const ok = res(); await handler({ method:'GET', url:'/api/version?check=unique-request-123' },ok);
  assert.equal(ok.statusCode,200); assert.equal(ok.body.checkedNonce,'unique-request-123'); assert.equal(ok.body.checkedAt,'2026-10-24T12:00:00.000Z'); assert.equal(ok.headers['Vercel-CDN-Cache-Control'],'no-store');
  const wrongMethod = res(); await handler({method:'POST',url:'/'},wrongMethod); assert.equal(wrongMethod.statusCode,405);
  const invalid = res(); await handler({method:'GET',url:'/api/version?check=short'},invalid); assert.equal(invalid.statusCode,400); assert.equal(reads,1);
  const unavailable = createVersionHandler({readManifest:async()=>{throw Error('missing file');}}), failure = res(); await unavailable({method:'GET',url:'/?check=unique-request-123'},failure); assert.equal(failure.statusCode,503); assert.equal(failure.body.error,'Version currently unavailable');
});
test('latest requires successful network check, including browser without worker; later failure never remains latest', async () => {
  const states = []; let fail = false;
  const checker = createUpdateChecker({ loadedCommit: manifest.commit, getRegistration: async () => undefined, fetchVersion: async () => { if (fail) throw Error(); return manifest; }, onState: (state) => states.push(state) });
  await checker.check(); assert.equal(states.at(-1).status, 'latest'); assert.ok(states.at(-1).checkedAt instanceof Date);
  fail = true; await checker.check(); assert.equal(states.at(-1).status, 'error'); checker.dispose();
});
test('worker update request is not ready: installing→downloading→waiting verified→ready; failed install preserves error', async () => {
  const reg = new Registration(), worker = new Worker(), states = [];
  reg.installing = worker;
  const checker = createUpdateChecker({ loadedCommit: 'c'.repeat(40), getRegistration: async () => reg, fetchVersion: async () => manifest, workerBuild: async () => manifest.build, onState: (state) => states.push(state) });
  await checker.check(); assert.equal(states.at(-1).status, 'downloading');
  reg.installing = null; reg.waiting = worker; worker.state = 'installed'; worker.dispatchEvent(new Event('statechange')); await tick(); assert.equal(states.at(-1).status, 'ready');
  worker.state = 'redundant'; worker.dispatchEvent(new Event('statechange')); await tick(); assert.equal(states.at(-1).status, 'error');
  reg.waiting = null; worker.dispatchEvent(new Event('statechange')); await tick(); assert.equal(states.at(-1).status, 'error'); checker.dispose();
});
test('unknown/wrong waiting worker never claims ready; no-worker older browser reports availability, not downloaded', async () => {
  for (const reg of [undefined, Object.assign(new Registration(), { waiting: new Worker() })]) {
    const states = []; const checker = createUpdateChecker({ loadedCommit: 'c'.repeat(40), getRegistration: async () => reg, fetchVersion: async () => manifest, workerBuild: async () => null, onState: (state) => states.push(state) });
    await checker.check(); assert.equal(states.at(-1).status, reg ? 'error' : 'available'); checker.dispose();
  }
});
test('coverage counts unique measured accounts, existing exclusions only; empty after filters differs from no original data', () => {
  assert.deepEqual(filterMeasuredAccounts(null), { before: null, excluded: null, included: null, rows: null });
  const rows = [{ ownerUid: 'owner' }, { ownerUid: 'owner' }, { ownerUid: 'other' }];
  const result = filterMeasuredAccounts(rows, ['owner', 'owner', 'missing']);
  assert.equal(result.before, 2); assert.equal(result.excluded, 1); assert.equal(result.included, 1);
  const empty = filterMeasuredAccounts(rows, ['owner', 'other']); assert.equal(empty.before, 2); assert.equal(empty.included, 0);
  assert.equal(filterMeasuredAccounts([]).before, 0);
  const now = new Date('2026-10-24T12:00:00Z'); const event = (id, uid, days = 0) => ({ id, ownerUid: uid, type: 'plan_saved', occurredAt: { seconds: now.getTime() / 1000 - days * 86400 } });
  const features = summarizeFeatureEvents([event('a', 'owner'), event('b', 'owner'), event('c', 'other'), event('d', 'old', 40)], { now, excludedUids: ['owner'], days: 7 });
  assert.equal(features.beforeAccounts, 2); assert.equal(features.excludedAccounts, 1); assert.equal(features.accounts, 1);
});
test('five demonstration scripts and all FAQ targets remain explicit; narration not advertised as integrated', () => {
  assert.equal(STORIES.length, 5); assert.ok(STORIES.every((story) => story.text && story.audioSrc === null));
  const all = FAQ_GROUPS.flatMap((group) => group.questions); assert.equal(new Set(all.map((q) => q.id)).size, all.length); assert.equal(all.length, 20);
  const valid = new Set(['diagram','changes','crew','sharing','compensatories','account','privacy','updates','wealth','notices','planner']);
  assert.ok(all.every((q) => !q.target || valid.has(q.target)));
});
