import { test, expect } from '@playwright/test';

const TODAY = '2026-09-14';
const DOCUMENTS = 'http://127.0.0.1:8086/v1/projects/demo-rostermax/databases/(default)/documents';
const ROOT = 'artifacts/roster-max-production';
const diagnostics = new WeakMap();

test.beforeEach(async ({ page }) => {
  const state = { errors: [], expectedOfflineMessages: [], offline: false };
  diagnostics.set(page, state);
  page.on('pageerror', (error) => state.errors.push(`Uncaught: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (state.offline && /ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|Failed to fetch|Could not reach Cloud Firestore backend/i.test(text)) state.expectedOfflineMessages.push(text);
    else state.errors.push(text);
  });
  await page.clock.setFixedTime(new Date(`${TODAY}T15:00:00Z`));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    // WebChannel connectivity probe after a simulated network loss. Stub it
    // locally as well; no request leaves the machine.
    if (url.hostname === 'www.google.com' && url.pathname === '/images/cleardot.gif') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' });
    // Host antivirus and Firebase Auth's preloaded Google bootstrap are not
    // part of these emulator-only session tests; never contact either host.
    if (url.hostname.endsWith('.scr.kaspersky-labs.com')) return route.fulfill({ contentType: 'application/javascript', body: '/* disabled in local emulator tests */' });
    if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'application/javascript', body: "document.currentScript.dispatchEvent(new Event('error'));" });
    if (url.hostname === 'api.open-meteo.com') return route.fulfill({ json: { current: { temperature_2m: 17, apparent_temperature: 16, weather_code: 1, wind_speed_10m: 14, wind_gusts_10m: 22, time: `${TODAY}T12:00` } } });
    if (url.hostname === 'geocoding-api.open-meteo.com') return route.fulfill({ json: { results: [] } });
    state.errors.push(`Unexpected external request: ${url.origin}${url.pathname}`);
    return route.abort();
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const state = diagnostics.get(page);
  await testInfo.attach('session-offline-diagnostics', { body: JSON.stringify(state, null, 2), contentType: 'application/json' });
  expect(state.errors, 'No application exceptions or production requests').toEqual([]);
});

function readDocument(request, path) {
  // "owner" is the local Firestore emulator's test-admin credential. The
  // endpoint is hard-coded to loopback and cannot address production.
  return request.get(`${DOCUMENTS}/${ROOT}/${path}`, { headers: { Authorization: 'Bearer owner' } });
}

async function userId(page) {
  return page.evaluate(async () => (await import('/src/lib/firebase.js')).auth.currentUser?.uid || null);
}

async function finishOnboarding(page, name, navigate = true) {
  if (navigate) await page.goto('/');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await dialog.getByLabel('Días trabajando').fill('7');
  await dialog.getByLabel('Días de franco').fill('7');
  await dialog.getByLabel('Inicio conocido del ciclo').fill(TODAY);
  await dialog.getByRole('button', { name: 'Guardar y continuar' }).click();
  await dialog.getByLabel('Nombre visible').fill(name);
  await dialog.getByLabel('Zona o yacimiento (privado)').fill('Zona privada de prueba');
  await dialog.getByRole('button', { name: 'Terminar y añadir compañeros' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('navigation').getByRole('button', { name: 'Roster', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Calendario de roster' })).toBeVisible();
}

async function addPlan(page, title) {
  await page.getByRole('navigation').getByRole('button', { name: 'Franco', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo plan', exact: true }).click();
  await page.getByLabel('¿Qué quieres hacer?').fill(title);
  await page.getByLabel('Fecha del plan').fill('2026-09-21');
  await page.getByRole('button', { name: 'Guardar plan', exact: true }).click();
  await expect(page.getByRole('button', { name: `Editar: ${title}`, exact: true })).toBeVisible();
}

async function savedTitles(request, uid) {
  const response = await readDocument(request, `users/${uid}/tasks`);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  return (payload.documents || []).map((document) => document.fields.title.stringValue).sort();
}

test('cambiar UID limpia perfil, planes y finanzas sin borrar la cuenta anterior', async ({ page, request }) => {
  await finishOnboarding(page, 'Cuenta A privada');
  const uidA = await userId(page);
  await addPlan(page, 'Plan exclusivo de cuenta A');
  await page.getByRole('navigation').getByRole('button', { name: 'Finanzas', exact: true }).click();
  await page.getByLabel('Ingreso previsto (ARS)').fill('777000');
  await page.getByLabel('Gastos fijos (ARS)').fill('123000');
  await page.getByRole('button', { name: 'Guardar este presupuesto' }).click();
  await expect(page.getByText(/Presupuesto de septiembre de 2026 guardado en ARS/)).toBeVisible();

  // Both accounts live in the same tab/IndexedDB. This catches state leaks
  // that isolated browser contexts would hide.
  await page.evaluate(async () => { await (await import('/src/lib/firebase.js')).auth.signOut(); });
  await expect.poll(() => userId(page)).not.toBe(uidA);
  await expect(page.getByRole('dialog')).toBeVisible();
  const uidB = await userId(page);
  expect(uidB).toBeTruthy();
  expect(uidB).not.toBe(uidA);
  await expect(page.getByText('Cuenta A privada', { exact: true })).toHaveCount(0);
  await finishOnboarding(page, 'Cuenta B privada', false);
  await page.getByRole('navigation').getByRole('button', { name: 'Franco', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar: Plan exclusivo de cuenta A', exact: true })).toHaveCount(0);
  await expect(page.getByText('No hay planes en esta vista.', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Finanzas', exact: true }).click();
  await expect(page.getByLabel('Ingreso previsto (ARS)')).toHaveValue('0');
  await expect(page.getByLabel('Gastos fijos (ARS)')).toHaveValue('0');
  await addPlan(page, 'Plan exclusivo de cuenta B');
  await expect.poll(() => savedTitles(request, uidA)).toEqual(['Plan exclusivo de cuenta A']);
  await expect.poll(() => savedTitles(request, uidB)).toEqual(['Plan exclusivo de cuenta B']);
});

test('guarda planes y gastos sin red y los sincroniza al reconectar, conservándolos tras recargar', async ({ page, context, request }) => {
  await finishOnboarding(page, 'Trabajador sin señal');
  const uid = await userId(page);
  // Load both private collections while online before losing connectivity.
  await page.getByRole('navigation').getByRole('button', { name: 'Finanzas', exact: true }).click();
  await expect(page.getByLabel('Monto (ARS)', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Franco', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nuevo plan', exact: true })).toBeVisible();
  diagnostics.get(page).offline = true;
  await context.setOffline(true);
  await expect(page.getByText('Modo Sin Conexión', { exact: true })).toBeVisible();
  await addPlan(page, 'Llamar a casa al recuperar señal');
  await expect(page.getByText('Cambios pendientes de sincronización', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Finanzas', exact: true }).click();
  await page.getByLabel('Monto (ARS)', { exact: true }).fill('4500');
  await page.getByLabel('Detalle (opcional)').fill('Vianda registrada sin red');
  await page.getByRole('button', { name: 'Registrar gasto', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Gastos registrados' }).getByText('Vianda registrada sin red', { exact: true })).toBeVisible();
  expect(await savedTitles(request, uid)).toEqual([]);
  const beforeReconnect = await readDocument(request, `users/${uid}/expenses`);
  expect((await beforeReconnect.json()).documents || []).toHaveLength(0);

  await context.setOffline(false);
  await expect(page.getByText('Modo Sin Conexión', { exact: true })).toHaveCount(0);
  await expect.poll(() => savedTitles(request, uid), { timeout: 25000 }).toEqual(['Llamar a casa al recuperar señal']);
  await expect.poll(async () => {
    const response = await readDocument(request, `users/${uid}/expenses`);
    const documents = (await response.json()).documents || [];
    return documents.map((document) => document.fields.note.stringValue);
  }, { timeout: 25000 }).toEqual(['Vianda registrada sin red']);
  await expect(page.getByText('Cambios pendientes de sincronización', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Sincronizando cambios…', { exact: true })).toHaveCount(0);
  diagnostics.get(page).offline = false;
  await page.reload();
  await expect.poll(() => userId(page)).toBe(uid);
  await page.getByRole('navigation').getByRole('button', { name: 'Franco', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar: Llamar a casa al recuperar señal', exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Finanzas', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Gastos registrados' }).getByText('Vianda registrada sin red', { exact: true })).toBeVisible();
});

test('una cuenta nueva no publica ni guarda el roster predeterminado antes de configurarlo', async ({ page, request }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const uid = await userId(page);
  await dialog.getByRole('button', { name: 'Lo haré más tarde', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configura tu primer roster', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Calendario de roster' })).toHaveCount(0);
  await page.getByRole('navigation').getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect.poll(async () => (await readDocument(request, `users/${uid}/settings/sync`)).status()).toBe(200);
  const sync = await (await readDocument(request, `users/${uid}/settings/sync`)).json();
  const code = sync.fields.code.stringValue;
  await expect(page.getByText(code, { exact: true })).toBeVisible();
  expect((await readDocument(request, `users/${uid}/settings/roster`)).status()).toBe(404);
  expect((await readDocument(request, `public/data/sync_codes/${code}`)).status()).toBe(404);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Configura tu primer roster', exact: true })).toBeVisible();
  expect((await readDocument(request, `public/data/sync_codes/${code}`)).status()).toBe(404);
});
