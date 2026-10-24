import { openConfiguration } from './helpers/configuration';
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const API = 'http://127.0.0.1:8086/v1/projects/demo-rostermax/databases/(default)/documents';
const ROOT = 'artifacts/roster-max-production';
const headers = { Authorization: 'Bearer owner' }; // emulator only
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    if (url.hostname.endsWith('.scr.kaspersky-labs.com')) return route.fulfill({ contentType:'application/javascript', body:'' });
    if (url.hostname === 'apis.google.com') return route.fulfill({ contentType:'application/javascript', body:"document.currentScript.dispatchEvent(new Event('error'));" });
    if (url.hostname === 'www.google.com' && url.pathname.endsWith('cleardot.gif')) return route.fulfill({ body:'' });
    return route.abort();
  });
});
async function setup(page) {
  await page.goto('/'); await openConfiguration(page);
  await page.getByRole('button', { name:'Comenzar', exact:true }).click();
  await page.getByLabel('Días trabajando').fill('14');
  await page.getByLabel('Días de franco').fill('14');
  await page.getByLabel('Inicio conocido del ciclo').fill('2026-10-01');
  await page.getByRole('button', { name:'Guardar y continuar' }).click();
  await page.getByLabel('Nombre visible', { exact:true }).fill('Prueba integral ficticia');
  await page.getByRole('button', { name:'Terminar y añadir compañeros' }).click();
  await page.getByRole('navigation').getByRole('button', { name:'Roster', exact:true }).click();
  await expect(page.getByRole('region', { name:'Calendario de roster' })).toBeVisible();
  return page.evaluate(async () => (await import('/src/lib/firebase.js')).auth.currentUser.uid);
}
async function dates(page) {
  return page.evaluate(async () => {
    const { db, APP_ID, auth } = await import('/src/lib/firebase.js');
    const { doc, getDoc } = await import((await (await fetch('/src/lib/firebase.js')).text()).match(/["'](\/node_modules\/\.vite\/deps\/firebase_firestore\.js[^"']*)["']/)[1]);
    const { getStatusForDate, addDaysToDate } = await import('/src/lib/roster.js');
    const config = (await getDoc(doc(db,'artifacts',APP_ID,'users',auth.currentUser.uid,'settings','roster'))).data();
    return Array.from({ length:732 },(_,i) => getStatusForDate(addDaysToDate('2024-12-01', i), config));
  });
}
async function screenshot(page, name) {
  await mkdir('audit/welcome/regression', { recursive:true });
  if (name.startsWith('compensatorios')) await page.getByRole('dialog').evaluate((dialog) => { dialog.scrollTop = 0; });
  await page.screenshot({ path:`audit/welcome/regression/${name}.png`, fullPage:!name.startsWith('compensatorios') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
}

for (const width of [390, 768, 1440]) test(`compensatorios independientes, historial y seis paneles a ${width}px`, async ({ page, request }) => {
  await page.setViewportSize({ width, height:900 });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const uid = await setup(page);
  const before = await dates(page);
  await page.getByRole('button', { name:'Ver historial y registrar' }).click();
  const modal = page.getByRole('dialog', { name:'Compensatorios', exact:true });
  await expect(modal.getByRole('button', { name:'Cerrar Compensatorios' })).toBeFocused();
  const create = async (direction, quantity) => {
    await modal.getByRole('button', { name:'Registrar días pendientes' }).click();
    await modal.getByLabel('Quién debe estos días').selectOption(direction);
    await modal.getByLabel('Cantidad de días').fill(String(quantity));
    await modal.getByRole('button', { name:'Guardar movimiento' }).click();
    await expect(modal.getByRole('button', { name:'Guardar movimiento' })).toHaveCount(0);
  };
  await create('company_owes', 3); await create('worker_owes', 2);
  const company = modal.getByRole('article', { name:/La empresa me debe del/ });
  const worker = modal.getByRole('article', { name:/Yo debo a la empresa del/ });
  await company.getByText('Ver detalles y registrar movimientos', { exact:true }).click();
  await company.getByRole('button', { name:'Registrar disfrute' }).click();
  await modal.getByLabel('Cantidad de días').fill('1');
  await modal.getByRole('button', { name:'Guardar movimiento' }).click();
  await expect(company).toContainText('2 días pendientes');
  await worker.getByText('Ver detalles y registrar movimientos', { exact:true }).click();
  await worker.getByRole('button', { name:'Registrar compensación', exact:true }).click();
  await modal.getByLabel('Cantidad de días').fill('0.5');
  // Two submissions in the same task exercise the synchronous duplicate guard.
  await modal.locator('form').evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
  await expect(worker).toContainText('1,5 días pendientes');
  expect(await dates(page)).toEqual(before);
  const entries = await request.get(`${API}/${ROOT}/users/${uid}/compensatory_entries`, { headers });
  expect((await entries.json()).documents).toHaveLength(4);
  const csvDownload = page.waitForEvent('download');
  await modal.getByRole('button', { name:'Exportar registro completo en CSV' }).click();
  expect((await csvDownload).suggestedFilename()).toMatch(/^rostermax-compensatorios-/);
  await modal.getByLabel('Estado del registro').selectOption('settled');
  await expect(modal.getByRole('article')).toHaveCount(0);
  await modal.getByLabel('Estado del registro').selectOption('all');
  await screenshot(page, `compensatorios-${width}`);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name:'Ver historial y registrar' })).toBeFocused();
  for (const tab of ['Roster','Equipo','Franco','Finanzas','Ajustes']) {
    await page.getByRole('navigation').getByRole('button', { name:tab, exact:true }).click();
    const titles = { Roster: 'Tu calendario', Equipo: 'Mi equipo', Franco: 'Tu tiempo de franco', Finanzas: 'Tu dinero, con un plan', Ajustes: 'Cuenta y sincronización' };
    await expect(page.getByRole('heading', { name:titles[tab], exact:true })).toBeVisible();
    await screenshot(page, `${tab.toLowerCase()}-${width}`);
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name:'Exportar mis datos privados' }).click();
  expect((await download).suggestedFilename()).toBe('rostermax-mis-datos.json');
  await request.patch(`${API}/${ROOT}/admins/${uid}`, { headers, data:{ fields:{ active:{ booleanValue:true } } } });
  await page.getByRole('navigation').getByRole('button', { name:'CEO', exact:true }).click();
  await expect(page.getByRole('region', { name:'Operación y funciones CEO' })).toBeVisible();
  await expect(page.getByRole('region', { name:'Operación y funciones CEO' })).not.toContainText('Cargando; sin información confirmada');
  await screenshot(page, `ceo-${width}`);
  await page.reload();
  await page.getByRole('button', { name:'Ver historial y registrar' }).click();
  await expect(page.getByRole('dialog').getByRole('article', { name:/Yo debo a la empresa del/ })).toContainText('1,5 días pendientes');
  expect(await dates(page)).toEqual(before);
  expect(errors).toEqual([]);
});
