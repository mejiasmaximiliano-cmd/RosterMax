import { Buffer } from 'node:buffer';
import { test, expect } from '@playwright/test';

const TODAY = '2026-09-26';
const diagnostics = new WeakMap();
const unfold = (contents) => contents.replace(/\r\n[ \t]/g, '');
const property = (contents, name) => unfold(contents).split('\r\n').find((line) => line.startsWith(`${name}:`))?.slice(name.length + 1);

test.beforeEach(async ({ page }) => {
  const errors = [];
  diagnostics.set(page, errors);
  page.on('pageerror', (error) => errors.push(`Uncaught: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.clock.setFixedTime(new Date(`${TODAY}T15:00:00Z`));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    if (url.hostname === 'api.open-meteo.com') return route.fulfill({ json: { current: { temperature_2m: 17, apparent_temperature: 16, weather_code: 1, wind_speed_10m: 14, wind_gusts_10m: 22, time: `${TODAY}T12:00` } } });
    if (url.hostname === 'geocoding-api.open-meteo.com') return route.fulfill({ json: { results: [] } });
    if (url.hostname.endsWith('.scr.kaspersky-labs.com')) return route.fulfill({ contentType: 'application/javascript', body: '/* Host antivirus disabled in emulator tests. */' });
    if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'application/javascript', body: "document.currentScript.dispatchEvent(new Event('error'));" });
    errors.push(`Unexpected external request: ${url.origin}${url.pathname}`);
    return route.abort();
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const errors = diagnostics.get(page) || [];
  await testInfo.attach('reminders-browser-errors', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors, 'No application exceptions or external writes').toEqual([]);
});

async function finishOnboarding(page) {
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Comenzar', exact: true }).click();
  await dialog.getByLabel('Días trabajando').fill('7');
  await dialog.getByLabel('Días de franco').fill('7');
  await dialog.getByLabel('Inicio conocido del ciclo').fill(TODAY);
  await dialog.getByRole('button', { name: 'Guardar y continuar' }).click();
  await dialog.getByLabel('Nombre visible').fill('Prueba de recordatorios');
  await dialog.getByLabel('Zona o yacimiento (privado)').fill('Añelo');
  await dialog.getByRole('button', { name: 'Terminar y añadir compañeros' }).click();
  await expect(dialog).toBeHidden();
}

async function downloadIcs(page, editor) {
  const downloading = page.waitForEvent('download');
  await editor.getByRole('button', { name: 'Descargar recordatorio (.ics)', exact: true }).click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  expect(stream).toBeTruthy();
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return { contents: Buffer.concat(chunks).toString('utf8'), filename: download.suggestedFilename() };
}

test('el plan descarga una alarma futura privada y renovar su fecha actualiza el editor', async ({ page }, testInfo) => {
  const title = 'Consulta familiar confidencial';
  await finishOnboarding(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Franco', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo plan', exact: true }).click();
  await page.getByLabel('¿Qué quieres hacer?').fill(title);
  await page.getByLabel('Fecha del plan').fill('2026-10-03');
  await page.getByLabel('Duración estimada (minutos)').fill('90');
  await page.getByRole('button', { name: 'Guardar plan', exact: true }).click();
  const card = page.getByRole('article').filter({ has: page.getByRole('button', { name: `Editar: ${title}`, exact: true }) });
  await expect(card).toBeVisible();
  await card.getByText('Recordatorio en mi calendario', { exact: true }).click();
  const editor = card.locator('details');
  await expect(editor.getByLabel('Fecha del recordatorio', { exact: true })).toHaveValue('2026-10-03');
  await expect(editor.getByLabel('Incluir el nombre del plan en el evento y su aviso')).not.toBeChecked();

  // At noon local time, 11:00 today has passed: no download should occur.
  let downloadCount = 0;
  page.on('download', () => { downloadCount += 1; });
  await editor.getByLabel('Fecha del recordatorio', { exact: true }).fill(TODAY);
  await editor.getByLabel('Hora local del calendario').fill('11:00');
  await editor.getByRole('button', { name: 'Descargar recordatorio (.ics)', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Elige una fecha y hora futuras');
  expect(downloadCount).toBe(0);

  await editor.getByLabel('Fecha del recordatorio', { exact: true }).fill('2026-10-03');
  await editor.getByLabel('Hora local del calendario').fill('11:30');
  await editor.getByRole('combobox', { name: 'Avisarme', exact: true }).selectOption('60');
  const first = await downloadIcs(page, editor);
  expect(first.filename).toBe('rostermax-plan-2026-10-03.ics');
  expect(property(first.contents, 'SUMMARY')).toBe('RosterMax: revisar mi plan');
  expect(property(first.contents, 'DTSTART')).toBe('20261003T113000');
  expect(property(first.contents, 'TRIGGER')).toBe('-PT60M');
  expect(property(first.contents, 'DURATION')).toBe('PT90M');
  expect(first.contents).toContain('BEGIN:VALARM\r\n');
  expect(unfold(first.contents)).not.toContain(title);
  await expect(editor.getByRole('status')).toContainText('La descarga por sí sola no activa una alarma');
  await testInfo.attach('plan-reminder.ics', { body: first.contents, contentType: 'text/calendar' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

  await card.getByRole('button', { name: `Editar: ${title}`, exact: true }).click();
  await page.getByLabel('Fecha del plan').fill('2026-10-04');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(editor).toHaveJSProperty('open', false);
  await card.getByText('Recordatorio en mi calendario', { exact: true }).click();
  await expect(editor.getByLabel('Fecha del recordatorio', { exact: true })).toHaveValue('2026-10-04');
  const updated = await downloadIcs(page, editor);
  expect(property(updated.contents, 'UID')).toBe(property(first.contents, 'UID'));
  expect(property(updated.contents, 'DTSTART')).toBe('20261004T090000');
});

test('la meta mensual exporta sin montos y prepara Google Calendar sin conectarse a Google', async ({ page }, testInfo) => {
  const title = 'Fondo familiar confidencial';
  await finishOnboarding(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Finanzas', exact: true }).click();
  await page.getByText('Crear una meta de ahorro', { exact: true }).click();
  await page.getByLabel('Nombre de la meta').fill(title);
  await page.getByLabel('Monto objetivo').fill('9876543');
  await page.getByLabel('Aporte mensual previsto').fill('76543');
  await page.getByRole('combobox', { name: 'Moneda de la meta', exact: true }).selectOption('USD');
  await page.getByRole('button', { name: 'Crear meta', exact: true }).click();
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await expect(card).toBeVisible();
  await card.getByText('Recordatorio en mi calendario', { exact: true }).click();
  const editor = card.locator('details');
  await expect(editor.getByLabel('Repetir cada mes')).toBeChecked();
  await expect(editor.getByLabel('Incluir el nombre de la meta en el evento y su aviso')).not.toBeChecked();
  await editor.getByLabel('Primer recordatorio', { exact: true }).fill('2026-10-31');
  await editor.getByLabel('Hora local del calendario').fill('08:45');
  await editor.getByRole('combobox', { name: 'Avisarme', exact: true }).selectOption('1440');
  const downloaded = await downloadIcs(page, editor);
  expect(downloaded.filename).toBe('rostermax-ahorro-2026-10-31.ics');
  expect(property(downloaded.contents, 'SUMMARY')).toBe('RosterMax: revisar mi ahorro');
  expect(property(downloaded.contents, 'RRULE')).toBe('FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1');
  expect(property(downloaded.contents, 'TRIGGER')).toBe('-PT1440M');
  expect(property(downloaded.contents, 'DTSTART')).toBe('20261031T084500');
  for (const secret of [title, '9876543', '76543', 'USD']) expect(unfold(downloaded.contents)).not.toContain(secret);
  await testInfo.attach('goal-reminder.ics', { body: downloaded.contents, contentType: 'text/calendar' });

  // Capture the user-triggered draft URL locally. This test never opens an
  // authenticated calendar, sends an external request, or saves an event.
  await page.evaluate(() => {
    window.__rostermaxCalendarDrafts = [];
    window.open = (url) => { window.__rostermaxCalendarDrafts.push(String(url)); return null; };
  });
  await editor.getByRole('button', { name: 'Abrir en Google Calendar', exact: true }).click();
  const drafts = await page.evaluate(() => window.__rostermaxCalendarDrafts);
  expect(drafts).toHaveLength(1);
  const url = new URL(drafts[0]);
  expect(url.origin).toBe('https://calendar.google.com');
  expect(url.searchParams.get('action')).toBe('TEMPLATE');
  expect(url.searchParams.get('text')).toBe('RosterMax: revisar mi ahorro');
  expect(url.searchParams.get('dates')).toBe('20261031T084500/20261031T090000');
  expect(url.searchParams.get('recur')).toBe(`RRULE:${property(downloaded.contents, 'RRULE')}`);
  expect(url.searchParams.get('details')).toContain('Configura una notificación 1440 minutos antes');
  for (const secret of [title, '9876543', '76543', 'USD']) expect(decodeURIComponent(url.href)).not.toContain(secret);
  await expect(editor.getByRole('status')).toContainText('RosterMax no puede confirmar');
  await expect(editor.getByRole('link', { name: /Si no se abrió, entrar a Google Calendar/ })).toHaveAttribute('href', url.href);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
});
