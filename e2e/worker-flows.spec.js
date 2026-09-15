import { test, expect } from '@playwright/test';

const TODAY = '2026-09-14';
const consoleErrors = new WeakMap();

async function preparePage(page, errors = []) {
  consoleErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(`Uncaught: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.clock.setFixedTime(new Date(`${TODAY}T15:00:00Z`));
  // These tests use local Firebase emulators only. Weather is deterministic;
  // all other external requests are stopped so no production data is touched.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    if (url.hostname === 'api.open-meteo.com') return route.fulfill({ json: { current: { temperature_2m: 17, apparent_temperature: 16, weather_code: 1, wind_speed_10m: 14, wind_gusts_10m: 22, time: `${TODAY}T12:00` } } });
    if (url.hostname === 'geocoding-api.open-meteo.com') return route.fulfill({ json: { results: [] } });
    // The workstation antivirus injects this script; Google SDK also preloads
    // its optional popup helper. Neither is exercised by anonymous auth here.
    if (url.hostname.endsWith('.scr.kaspersky-labs.com')) {
      return route.fulfill({ contentType: 'application/javascript', body: '/* External integration disabled in emulator tests. */' });
    }
    if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') {
      // Settle Firebase's optional mobile popup preload as unavailable; an
      // empty script would leave its callback pending and stall anonymous auth.
      return route.fulfill({ contentType: 'application/javascript', body: "document.currentScript.dispatchEvent(new Event('error'));" });
    }
    errors.push(`Unexpected external request: ${url.origin}${url.pathname}`);
    return route.abort();
  });
}

test.beforeEach(async ({ page }) => preparePage(page));

test.afterEach(async ({ page }, testInfo) => {
  const errors = consoleErrors.get(page) || [];
  await testInfo.attach('browser-errors', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors, 'No browser exceptions, console errors, or production network requests').toEqual([]);
});

async function finishOnboarding(page, name = 'Trabajador de prueba') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Días trabajando').fill('7');
  await dialog.getByLabel('Días de franco').fill('7');
  await dialog.getByLabel('Inicio conocido del ciclo').fill(TODAY);
  await dialog.getByRole('button', { name: 'Guardar y continuar' }).click();
  await dialog.getByLabel('Nombre visible').fill(name);
  await dialog.getByLabel('Zona o yacimiento (privado)').fill('Añelo');
  await dialog.getByRole('button', { name: 'Terminar y añadir compañeros' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('navigation').getByRole('button', { name: 'Roster', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Calendario de roster' })).toBeVisible();
}

async function captureMobile(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  const viewportWidth = page.viewportSize().width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth), 'No horizontal overflow on mobile').toBeLessThanOrEqual(viewportWidth);
}

test('onboarding, calendario, crear y editar un plan con persistencia', async ({ page }, testInfo) => {
  await finishOnboarding(page);
  const calendar = page.getByRole('region', { name: 'Calendario de roster' });
  await expect(calendar.getByText('septiembre de 2026', { exact: true })).toBeVisible();
  await calendar.getByRole('button', { name: /^lunes,? 21 de septiembre: Franco/ }).click();
  await calendar.getByRole('button', { name: 'Planificar', exact: true }).click();
  await expect(page.getByLabel('Fecha del plan')).toHaveValue('2026-09-21');
  await page.getByLabel('¿Qué quieres hacer?').fill('Salida con mi familia');
  await page.getByLabel('Duración estimada (minutos)').fill('90');
  await page.getByRole('button', { name: 'Guardar plan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar: Salida con mi familia' })).toBeVisible();
  await page.getByRole('button', { name: 'Editar: Salida con mi familia' }).click();
  await page.getByLabel('¿Qué quieres hacer?').fill('Salida familiar al parque');
  await page.getByLabel('Fecha del plan').fill('2026-09-22');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar: Salida familiar al parque' })).toBeVisible();
  await captureMobile(page, testInfo, 'franco-mobile');
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Franco', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar: Salida familiar al parque' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Roster', exact: true }).click();
  await calendar.getByRole('button', { name: /^martes,? 22 de septiembre: Franco, 1 planes/ }).click();
  await expect(calendar.getByText('Salida familiar al parque', { exact: true })).toBeVisible();
  await captureMobile(page, testInfo, 'calendario-mobile');
});

test('licencia médica modifica disponibilidad, permite una cita y vuelve al roster normal', async ({ page }, testInfo) => {
  await finishOnboarding(page);
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await page.getByLabel('Tipo de cambio').selectOption('medical');
  await page.getByLabel('Nota privada (opcional)').fill('Control privado');
  await page.getByLabel('Desde', { exact: true }).fill('2026-09-15');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-09-16');
  await page.getByRole('button', { name: 'Aplicar cambio temporal' }).click();
  await expect(page.getByRole('button', { name: 'Editar Carpeta médica' })).toBeVisible();
  const calendar = page.getByRole('region', { name: 'Calendario de roster' });
  await calendar.getByRole('button', { name: /^martes,? 15 de septiembre: Control privado/ }).click();
  await expect(calendar.getByText('Este día es de recuperación;', { exact: false })).toBeVisible();
  await calendar.getByRole('button', { name: 'Planificar', exact: true }).click();
  await expect(page.getByText('Este día no se cuenta como franco.', { exact: false })).toBeVisible();
  await page.getByLabel('¿Qué quieres hacer?').fill('Turno de seguimiento');
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption('health');
  await page.getByRole('button', { name: 'Guardar plan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Editar: Turno de seguimiento' })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Roster', exact: true }).click();
  await calendar.getByRole('button', { name: /^jueves,? 17 de septiembre: Trabajo/ }).click();
  await expect(calendar.getByText('Día 4 de 7 de trabajo', { exact: true })).toBeVisible();
  await captureMobile(page, testInfo, 'cambio-temporal-mobile');
});

test('presupuesto por mes y moneda, gasto persistido y meta de ahorro', async ({ page }, testInfo) => {
  await finishOnboarding(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Finanzas', exact: true }).click();
  await page.getByLabel('Ingreso previsto (ARS)').fill('1000000');
  await page.getByLabel('Gastos fijos (ARS)').fill('300000');
  await page.getByLabel('Ahorro a reservar (ARS)').fill('100000');
  await page.getByRole('button', { name: 'Guardar este presupuesto' }).click();
  await expect(page.getByText(/Presupuesto de septiembre de 2026 guardado en ARS/)).toBeVisible();
  await page.getByLabel('Monto (ARS)', { exact: true }).fill('25000');
  await page.getByLabel('Detalle (opcional)').fill('Pasaje a casa');
  await page.getByLabel('Fecha del gasto').fill(TODAY);
  await page.getByRole('button', { name: 'Registrar gasto', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Gastos registrados' }).getByText('Pasaje a casa', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Moneda', exact: true }).selectOption('USD');
  await expect(page.getByText('Todavía no hay gastos en USD para este mes.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Ingreso previsto (USD)')).toHaveValue('0');
  await page.getByLabel('Ingreso previsto (USD)').fill('2000');
  await page.getByLabel('Gastos fijos (USD)').fill('300');
  await page.getByLabel('Ahorro a reservar (USD)').fill('500');
  await page.getByRole('button', { name: 'Guardar este presupuesto' }).click();
  await expect(page.getByText(/Presupuesto de septiembre de 2026 guardado en USD/)).toBeVisible();
  await page.getByRole('combobox', { name: 'Moneda', exact: true }).selectOption('ARS');
  await expect(page.getByLabel('Ingreso previsto (ARS)')).toHaveValue('1000000');
  await page.getByLabel('Mes del presupuesto').fill('2026-10');
  await expect(page.getByLabel('Ingreso previsto (ARS)')).toHaveValue('0');
  await page.getByLabel('Ingreso previsto (ARS)').fill('1200000');
  await page.getByLabel('Gastos fijos (ARS)').fill('400000');
  await page.getByLabel('Ahorro a reservar (ARS)').fill('200000');
  await page.getByRole('button', { name: 'Guardar este presupuesto' }).click();
  await expect(page.getByText(/Presupuesto de octubre de 2026 guardado en ARS/)).toBeVisible();
  await page.getByLabel('Mes del presupuesto').fill('2026-09');
  await expect(page.getByLabel('Ingreso previsto (ARS)')).toHaveValue('1000000');
  await page.getByText('Crear una meta de ahorro', { exact: true }).click();
  await page.getByLabel('Nombre de la meta').fill('Fondo de emergencia');
  await page.getByLabel('Monto objetivo').fill('500000');
  await page.getByLabel('Aporte mensual previsto').fill('50000');
  await page.getByRole('button', { name: 'Crear meta', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Fondo de emergencia', exact: true })).toBeVisible();
  await captureMobile(page, testInfo, 'finanzas-mobile');
  await page.reload();
  await page.getByRole('navigation').getByRole('button', { name: 'Finanzas', exact: true }).click();
  await expect(page.getByLabel('Ingreso previsto (ARS)')).toHaveValue('1000000');
  await expect(page.getByRole('list', { name: 'Gastos registrados' }).getByText('Pasaje a casa', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Moneda', exact: true }).selectOption('USD');
  await expect(page.getByLabel('Ingreso previsto (USD)')).toHaveValue('2000');
  await page.getByRole('combobox', { name: 'Moneda', exact: true }).selectOption('ARS');
  await page.getByLabel('Mes del presupuesto').fill('2026-10');
  await expect(page.getByLabel('Ingreso previsto (ARS)')).toHaveValue('1200000');
});

test('una invitación enlaza ambos equipos y oculta el motivo médico compartido', async ({ page, browser }, testInfo) => {
  await finishOnboarding(page, 'Alicia Roster');
  await page.getByRole('navigation').getByRole('button', { name: 'Ajustes', exact: true }).click();
  const codeLabel = page.getByText(/^RM-[A-Z0-9]{8}$/);
  await expect(codeLabel).toBeVisible();
  const inviteCode = await codeLabel.textContent();
  const colleagueContext = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', viewport: page.viewportSize(), isMobile: true, hasTouch: true, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', serviceWorkers: 'block' });
  try {
    const colleague = await colleagueContext.newPage();
    await preparePage(colleague, consoleErrors.get(page));
    await finishOnboarding(colleague, 'Bruno Roster');
    await colleague.goto(`/?sync=${inviteCode}`);
    const accept = colleague.getByRole('button', { name: 'Aceptar y compartir', exact: true });
    await expect(accept).toBeEnabled();
    await accept.click();
    await expect(colleague.getByRole('button', { name: 'Eliminar a Alicia Roster', exact: true })).toBeVisible();
    await page.getByRole('navigation').getByRole('button', { name: 'Equipo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Eliminar a Bruno Roster', exact: true })).toBeVisible();
    await colleague.getByRole('navigation').getByRole('button', { name: 'Roster', exact: true }).click();
    await colleague.getByRole('button', { name: 'Agregar', exact: true }).click();
    await colleague.getByRole('combobox', { name: 'Tipo de cambio', exact: true }).selectOption('medical');
    await colleague.getByLabel('Nota privada (opcional)').fill('Diagnóstico privado que nadie debe ver');
    await colleague.getByLabel('Desde', { exact: true }).fill('2026-09-21');
    await colleague.getByLabel('Hasta', { exact: true }).fill('2026-09-22');
    await colleague.getByRole('button', { name: 'Aplicar cambio temporal' }).click();
    await expect(colleague.getByRole('button', { name: 'Editar Carpeta médica' })).toBeVisible();
    await page.getByLabel('Fecha para comparar rosters').fill('2026-09-21');
    await expect(page.getByText('No disponible', { exact: true })).toBeVisible();
    await expect(page.getByText('Diagnóstico privado que nadie debe ver', { exact: true })).toHaveCount(0);
    await expect(page.getByText('¡COINCIDEN!', { exact: true })).toHaveCount(0);
    await captureMobile(page, testInfo, 'equipo-reciproco-mobile');
  } finally {
    await colleagueContext.close();
  }
});
