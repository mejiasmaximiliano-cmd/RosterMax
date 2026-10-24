import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import process from 'node:process';

// No production sign-in, account creation or Firestore writes. Browser API calls
// are intercepted; real public GETs validate deployed HTML, worker and assets.
const origin = 'https://rostermax.vercel.app';
const expected = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(expected || '')) throw new Error('Pass the exact expected deployed commit SHA.');
const read = async (path) => {
  const response = await fetch(origin + path, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (response.status !== 200) throw new Error(`Public resource ${path}: HTTP ${response.status}`);
  return { body: await response.text(), contentType: response.headers.get('content-type') };
};
const version = JSON.parse((await read('/version.json')).body);
if (version.commit !== expected || version.environment !== 'production') throw new Error('The public alias is not serving the expected production commit.');
const html = await read('/');
const worker = await read('/sw.js');
if (!worker.body.includes(version.build)) throw new Error('Worker and version manifest differ.');
const assets = JSON.parse(worker.body.match(/const LAZY_ASSETS = (\[[^;]+\])/)[1]);
const resources = [];
for (const path of assets) {
  const result = await read(path);
  if (/\.js$/.test(path) && !result.contentType.includes('javascript')) throw new Error('Invalid JavaScript content type.');
  resources.push({ path, bytes: Buffer.byteLength(result.body), sha256: createHash('sha256').update(result.body).digest('hex') });
}
const denials = {};
for (const [name, path] of Object.entries({ ceo: 'admin_stats/accounts', privateLedger: 'users/unauthenticated-read-probe/compensatory_debts' })) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/rostermax-60242/databases/(default)/documents/artifacts/roster-max-production/${path}`, { signal: AbortSignal.timeout(30000) });
  denials[name] = response.status;
  if (![401, 403].includes(response.status)) throw new Error(`Unauthenticated ${name} must be denied.`);
}
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', serviceWorkers: 'allow' });
const blocked = [], unexpectedNetwork = [], errors = [];
await context.route('**/*', (route) => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin === origin && request.method() === 'GET') return route.continue();
  blocked.push({ host: url.hostname, path: url.pathname, method: request.method() }); // never query/body/token
  if (url.hostname === 'identitytoolkit.googleapis.com') return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message: 'OPERATION_NOT_ALLOWED' } }) });
  return route.abort();
});
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => { if (new URL(response.url()).origin === origin && response.status() >= 400) unexpectedNetwork.push({ path: new URL(response.url()).pathname, status: response.status() }); });
try {
  const response = await page.goto(origin, { waitUntil: 'domcontentloaded' });
  if (response.status() !== 200) throw new Error('Public HTML unavailable.');
  await page.getByRole('button', { name: 'Volver a intentar', exact: true }).waitFor();
  if (await page.getByText('Este entorno todavía no está configurado', { exact:true }).count()) throw new Error('Production environment rejected.');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const cache = await page.evaluate(async () => ({ controller: Boolean(navigator.serviceWorker.controller), keys: await caches.keys() }));
  if (!cache.keys.some((key) => key.endsWith(version.build))) throw new Error('Published complete PWA cache is absent.');
  if (errors.length || unexpectedNetwork.length) throw new Error('Unexpected runtime or public-resource failure.');
  await mkdir('audit/release', { recursive: true });
  await page.screenshot({ path: 'audit/release/production-readonly-session-gate-390.png' });
  const result = { checkedAt: new Date().toISOString(), origin, version, htmlStatus: 200, resources, denials, browser: { pageErrors: errors, unexpectedPublicNetwork: unexpectedNetwork, blockedBackendRequests: blocked, cache, scope: 'REAL production assets/worker execution. Auth deliberately intercepted BEFORE account creation; expected session-error screenshot is NOT a production outage. No real-session navigation, OAuth, data writes or physical-phone claims.' } };
  await writeFile('audit/release/production-check.json', JSON.stringify(result, null, 2));
  process.stdout.write(JSON.stringify({ checkedAt: result.checkedAt, version, resources: resources.length, denials, unexpectedErrors: errors.length + unexpectedNetwork.length, productionWrites: 0, note: result.browser.scope }, null, 2) + '\n');
} finally { await context.close(); await browser.close(); }
