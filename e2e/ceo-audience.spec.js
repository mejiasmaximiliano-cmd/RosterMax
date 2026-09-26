import { test, expect } from '@playwright/test';

const DOCUMENTS = 'http://127.0.0.1:8086/v1/projects/demo-rostermax/databases/(default)/documents';
const ROOT = 'artifacts/roster-max-production';
const NOW = '2026-09-14T15:00:00Z';

async function seed(request, path, fields) {
  const response = await request.patch(`${DOCUMENTS}/${ROOT}/${path}`, {
    headers: { Authorization: 'Bearer owner' }, data: { fields },
  });
  expect(response.ok()).toBeTruthy();
}

test('CEO separa cuentas reales de actividad voluntaria y conserva privacidad', async ({ page, request }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date(NOW));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    if (url.hostname.endsWith('.scr.kaspersky-labs.com')) return route.fulfill({ contentType: 'application/javascript', body: '' });
    if (url.hostname === 'apis.google.com') return route.fulfill({ contentType: 'application/javascript', body: "document.currentScript.dispatchEvent(new Event('error'));" });
    if (url.hostname === 'api.open-meteo.com') return route.fulfill({ json: { current: { temperature_2m: 17, time: '2026-09-14T12:00' } } });
    errors.push(`Unexpected external request: ${url.origin}${url.pathname}`);
    return route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Lo haré más tarde' }).click();
  const navigation = page.getByRole('navigation');
  await expect(navigation.getByRole('button', { name: 'CEO', exact: true })).toHaveCount(0);
  const uid = await page.evaluate(async () => (await import('/src/lib/firebase.js')).auth.currentUser.uid);
  await seed(request, 'admin_stats/accounts', {
    schemaVersion: { integerValue: '1' }, source: { stringValue: 'firebase-auth' }, projectId: { stringValue: 'rostermax-60242' },
    totalAccounts: { integerValue: '150' }, registeredAccounts: { integerValue: '4' }, guestAccounts: { integerValue: '146' },
    googleAccounts: { integerValue: '4' }, disabledAccounts: { integerValue: '0' },
    createdLast7Days: { integerValue: '3' }, createdLast30Days: { integerValue: '10' },
    signInsLast24Hours: { integerValue: '1' }, signInsLast7Days: { integerValue: '2' }, signInsLast30Days: { integerValue: '5' },
    generatedAt: { timestampValue: NOW },
  });
  await seed(request, `admins/${uid}`, { active: { booleanValue: true } });
  await navigation.getByRole('button', { name: 'CEO', exact: true }).click();
  const audience = page.getByRole('region', { name: 'Cuentas y actividad del CEO' });
  await expect(audience.getByText('Cuentas guardadas', { exact: true }).locator('..')).toContainText('4');
  await expect(audience.getByText('Cuentas de invitado', { exact: true }).locator('..')).toContainText('146');
  await expect(audience.getByText('Sin muestra de actividad.', { exact: false })).toBeVisible();
  await expect(audience.getByText('Cuentas con medición', { exact: true }).locator('..')).toContainText('0');
  await seed(request, `public/data/activity/${uid}`, {
    ownerUid: { stringValue: uid }, accountType: { stringValue: 'google' },
    firstSeenAt: { timestampValue: NOW }, lastActiveAt: { timestampValue: NOW }, lastActiveDay: { stringValue: '2026-09-14' },
    installDetected: { booleanValue: true }, rosterConfigured: { booleanValue: true }, profileComplete: { booleanValue: true }, appVersion: { stringValue: 'beta-0.6' },
  });
  await expect(audience.getByText('Cuentas con medición', { exact: true }).locator('..')).toContainText('1');
  await expect(audience.getByText('Activas medidas · 24 h', { exact: true }).locator('..')).toContainText('1');
  await expect(audience.getByText('Cuentas guardadas', { exact: true }).locator('..')).toContainText('4');
  await expect(audience).not.toContainText(uid);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  await page.screenshot({ path: testInfo.outputPath('ceo-mobile.png'), fullPage: true });
  // Revoking the private admin record removes the panel immediately.
  await seed(request, `admins/${uid}`, { active: { booleanValue: false } });
  await expect(audience).toHaveCount(0);
  await expect(navigation.getByRole('button', { name: 'CEO', exact: true })).toHaveCount(0);
  await request.delete(`${DOCUMENTS}/${ROOT}/public/data/activity/${uid}`, { headers: { Authorization: 'Bearer owner' } });
  expect(errors).toEqual([]);
});
