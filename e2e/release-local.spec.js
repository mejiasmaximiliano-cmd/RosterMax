import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';

async function localOnly(context) {
  await context.route('**/*', (route) => {
    const { hostname, pathname } = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(hostname)) return route.continue();
    if (hostname.endsWith('.scr.kaspersky-labs.com')) return route.fulfill({ contentType: 'application/javascript', body: '' });
    if (hostname === 'apis.google.com') return route.fulfill({ contentType: 'application/javascript', body: "document.currentScript.dispatchEvent(new Event('error'));" });
    if (hostname === 'www.google.com' && pathname.endsWith('cleardot.gif')) return route.fulfill({ body: '' });
    return route.abort();
  });
}

test('móvil claro/oscuro, altura reducida equivalente al teclado, acciones y cifras grandes sin desbordes', async ({ page, context }) => {
  await localOnly(context); await page.setViewportSize({ width: 390, height: 844 });
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/'); await page.getByRole('button', { name: 'Omitir presentación' }).click();
  await mkdir('audit/welcome/regression', { recursive: true });
  for (const [theme, label] of [['light', 'Claro'], ['dark', 'Oscuro']]) {
    await page.getByRole('navigation').getByRole('button', { name: 'Ajustes', exact: true }).click();
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('navigation').getByRole('button', { name: 'Equipo', exact: true }).click();
    const team = page.getByRole('heading', { name: 'Mi equipo', exact: true });
    const add = page.getByText('Añadir compañero', { exact: true });
    expect((await team.boundingBox()).y).toBeLessThan((await add.boundingBox()).y);
    await add.click();
    const rest = page.getByLabel('Descanso', { exact: true });
    await rest.fill('14');
    expect((await rest.boundingBox()).width).toBeLessThan(190);
    expect((await rest.boundingBox()).x + (await rest.boundingBox()).width).toBeLessThanOrEqual(390);
    await page.getByRole('navigation').getByRole('button', { name: 'Roster', exact: true }).click();
    await page.getByRole('button', { name: 'Ver historial y registrar' }).click();
    await page.getByRole('button', { name: 'Registrar días pendientes' }).click();
    await page.setViewportSize({ width: 390, height: 420 });
    await page.getByLabel('Observación personal (opcional)').fill('Prueba local de teclado, sin información real.');
    await page.getByRole('button', { name: 'Guardar movimiento' }).scrollIntoViewIfNeeded();
    const bounds = await page.getByRole('button', { name: 'Guardar movimiento' }).boundingBox();
    expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(420);
    await page.screenshot({ path: `audit/welcome/regression/dialogo-teclado-${theme}-390.png` });
    await page.keyboard.press('Escape'); await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('navigation').getByRole('button', { name: 'Finanzas', exact: true }).click();
    await page.getByText('Editar presupuesto mensual', { exact: true }).click();
    await page.getByLabel('Ingreso previsto (ARS)').fill('1000000000000');
    await page.getByRole('button', { name: 'Guardar este presupuesto' }).click();
    await expect(page.getByText(/Presupuesto de .* guardado en ARS/)).toBeVisible();
    await expect(page.getByText('Disponible estimado', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: `audit/welcome/regression/finanzas-${theme}-390.png`, fullPage: true });
    // Check fixed navigation on a real viewport screenshot, not a full-page stitching artifact.
    const nav = await page.getByRole('navigation').boundingBox(); expect(nav.y + nav.height).toBeLessThanOrEqual(844);
    await page.screenshot({ path: `audit/welcome/regression/navegacion-${theme}-390.png` });
  }
  expect(errors).toEqual([]);
});

test('medición de carga inicial compilada local, tres contextos fríos; recursos secundarios diferidos', async ({ browser }) => {
  const base = resolve('dist');
  const server = createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = resolve(base, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(base + '\\') && !file.startsWith(base + '/')) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); res.end(readFileSync(file));
  });
  await new Promise((done) => server.listen(5587, '127.0.0.1', done));
  const runs = [];
  try {
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await localOnly(context); const page = await context.newPage();
      await page.goto('http://127.0.0.1:5587/');
      await expect(page.getByRole('dialog', { name: 'Conocé RosterMax', exact: true })).toBeVisible();
      const result = await page.evaluate(() => ({ navigation: performance.getEntriesByType('navigation').map((entry) => ({ domContentLoadedMs: entry.domContentLoadedEventEnd, loadMs: entry.loadEventEnd })), assets: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/assets/')).map((entry) => ({ name: entry.name.split('/').at(-1), bytes: entry.encodedBodySize, durationMs: entry.duration })) }));
      expect(result.assets.some((asset) => /FinancePanel|CeoAudiencePanel|CeoOperationsPanel|PlannerPanel/.test(asset.name))).toBe(false);
      runs.push(result);
      if (i === 2) {
        await page.getByRole('button', { name: 'Omitir presentación' }).click();
        await page.route('**/assets/FinancePanel-*.js', (route) => route.abort());
        await page.getByRole('navigation').getByRole('button', { name: 'Finanzas', exact:true }).click();
        await expect(page.getByRole('heading', { name: 'No pudimos abrir esta sección', exact:true })).toBeVisible();
        await page.getByRole('button', { name: 'Volver a Roster', exact:true }).click();
        await expect(page.getByRole('region', { name: 'Mis compensatorios' })).toBeVisible();
      }
      await context.close();
    }
    await mkdir('audit/welcome/regression', { recursive: true });
    await writeFile('audit/welcome/regression/initial-load-local.json', JSON.stringify({ environment: 'LOCAL EMULATOR; synthetic accounts; Chrome; loopback; no throttling; service worker disabled for initial-load isolation; not phone speed or production CWV', runs }, null, 2));
  } finally { await new Promise((done) => server.close(done)); }
});
