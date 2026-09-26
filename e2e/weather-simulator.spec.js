import { test, expect } from '@playwright/test';

const TODAY = '2026-09-14';
const browserErrors = new WeakMap();

function forecastFixture() {
  const days = Array.from({ length: 7 }, (_, index) => `2026-09-${14 + index}`);
  const hours = days.flatMap((date) => Array.from({ length: 24 }, (_, hour) => `${date}T${String(hour).padStart(2, '0')}:00`));
  return {
    timezone: 'America/Argentina/Buenos_Aires', utc_offset_seconds: -10800,
    current: { temperature_2m: 17, apparent_temperature: 16, weather_code: 1, wind_speed_10m: 14, wind_gusts_10m: 22, time: `${TODAY}T12:00` },
    daily: {
      time: days, temperature_2m_max: days.map((_, index) => 24 + index), temperature_2m_min: days.map((_, index) => 7 + index),
      weather_code: [1, 61, 2, 3, 0, 45, 95], precipitation_probability_max: [0, 80, 20, 10, 0, 5, 90],
      precipitation_sum: [0, 12.7, 0.2, 0, 0, 0, 8.5], wind_speed_10m_max: days.map(() => 25), wind_gusts_10m_max: days.map(() => 42),
    },
    hourly: {
      time: hours, temperature_2m: hours.map(() => 18), weather_code: hours.map(() => 2),
      precipitation_probability: hours.map(() => 20), precipitation: hours.map(() => 0.4),
      wind_speed_10m: hours.map(() => 16), wind_gusts_10m: hours.map(() => 25),
    },
  };
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(`Uncaught: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.clock.setFixedTime(new Date(`${TODAY}T15:00:00Z`));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    if (url.hostname === 'api.open-meteo.com') return route.fulfill({ json: forecastFixture() });
    if (url.hostname === 'geocoding-api.open-meteo.com') return route.fulfill({ json: { results: [] } });
    // Known workstation injection and unused popup preload are settled locally;
    // Firebase, app data and all other production requests stay blocked.
    if (url.hostname.endsWith('.scr.kaspersky-labs.com')) return route.fulfill({ contentType: 'application/javascript', body: '/* External integration disabled in emulator tests. */' });
    if (url.hostname === 'apis.google.com' && url.pathname === '/js/api.js') return route.fulfill({ contentType: 'application/javascript', body: "document.currentScript.dispatchEvent(new Event('error'));" });
    errors.push(`Unexpected external request: ${url.origin}${url.pathname}`);
    return route.abort();
  });
});

test.afterEach(async ({ page }, testInfo) => {
  const errors = browserErrors.get(page) || [];
  await testInfo.attach('browser-errors', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors, 'No browser errors or external app-data requests').toEqual([]);
});

async function finishOnboarding(page, { workDays = 7, restDays = 7, startDate = TODAY } = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Comenzar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Días trabajando').fill(String(workDays));
  await dialog.getByLabel('Días de franco').fill(String(restDays));
  await dialog.getByLabel('Inicio conocido del ciclo').fill(startDate);
  await dialog.getByRole('button', { name: 'Guardar y continuar' }).click();
  await dialog.getByLabel('Nombre visible').fill('Prueba de clima y turnos');
  await dialog.getByLabel('Zona o yacimiento (privado)').fill('Añelo');
  await dialog.getByRole('button', { name: 'Terminar y añadir compañeros' }).click();
  await expect(dialog).toBeHidden();
}

async function screenshot(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth), 'Mobile page stays inside viewport').toBeLessThanOrEqual(page.viewportSize().width);
}

test('clima móvil abre siete días, cambia el detalle horario y devuelve el foco al cerrar', async ({ page }, testInfo) => {
  await finishOnboarding(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Roster', exact: true }).click();
  const trigger = page.getByRole('button', { name: /Ver pronóstico de 7 días en/ });
  await expect(trigger).toContainText('17°C');
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Tu pronóstico' });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Cerrar pronóstico' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: 'Open-Meteo', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();

  const dayButtons = dialog.getByRole('group', { name: 'Días del pronóstico' }).getByRole('button');
  await expect(dayButtons).toHaveCount(7);
  await expect(dayButtons.first()).toHaveAttribute('aria-pressed', 'true');
  const hourly = dialog.getByRole('region', { name: 'Pronóstico por hora' });
  await expect(hourly.getByRole('article')).toHaveCount(12);
  await expect(hourly.getByRole('article').first()).toContainText('12:00');
  await dayButtons.nth(1).click();
  await expect(dayButtons.nth(1)).toHaveAttribute('aria-pressed', 'true');
  const selectedDay = dialog.getByRole('region', { name: 'Detalle del 2026-09-15' });
  await expect(selectedDay).toContainText('25° / 8°');
  await expect(selectedDay).toContainText('80%');
  await expect(selectedDay).toContainText('12.7 mm');
  await expect(hourly.getByRole('article')).toHaveCount(24);
  await expect(hourly.getByRole('article').first()).toContainText('00:00');
  await expect(dialog.getByText(/Dato de las 12:00 del 14 sept/)).toBeVisible();
  await expect(dialog.getByText(/La hora de consulta no es la hora de actualización del modelo/)).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth), 'Modal contains horizontal forecast scrollers without overflowing').toBe(true);
  await screenshot(page, testInfo, 'pronostico-extendido-mobile');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('simulador muestra día 10 de 14 trabajando y día 5 de 7 de franco junto a un colega', async ({ page }, testInfo) => {
  await finishOnboarding(page, { workDays: 14, restDays: 7, startDate: '2026-09-05' });
  const simulator = page.getByRole('region', { name: 'Simulador de fechas' });
  await simulator.getByLabel('Fecha para comparar rosters').fill(TODAY);
  const own = simulator.getByRole('article', { name: 'Roster de Tú' });
  await expect(own).toContainText('Día 10 de 14 de trabajo');
  await page.getByRole('button', { name: 'Carga Manual', exact: true }).click();
  const manualForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Guardar Manualmente', exact: true }) });
  await manualForm.getByPlaceholder('Nombre', { exact: true }).fill('Colega 7x7');
  await manualForm.getByPlaceholder('Trabajo', { exact: true }).fill('7');
  await manualForm.getByPlaceholder('Descanso', { exact: true }).fill('7');
  await manualForm.locator('input[name="start"]').fill('2026-09-10');
  await manualForm.getByRole('button', { name: 'Guardar Manualmente', exact: true }).click();
  const colleague = simulator.getByRole('article', { name: 'Roster de Colega 7x7' });
  await expect(colleague).toContainText('Día 5 de 7 de trabajo');
  await expect(colleague.getByText('¡COINCIDEN!', { exact: true })).toHaveCount(0);
  await simulator.getByLabel('Fecha para comparar rosters').fill('2026-09-23');
  await expect(own).toContainText('Día 5 de 7 de franco');
  await expect(colleague).toContainText('Día 7 de 7 de franco');
  await expect(colleague.getByText('¡COINCIDEN!', { exact: true })).toBeVisible();
  await simulator.scrollIntoViewIfNeeded();
  await screenshot(page, testInfo, 'simulador-dias-del-ciclo-mobile');
  await simulator.getByRole('button', { name: 'Hoy', exact: true }).click();
  await expect(simulator.getByLabel('Fecha para comparar rosters')).toHaveValue(TODAY);
  await expect(own).toContainText('Día 10 de 14 de trabajo');
});
