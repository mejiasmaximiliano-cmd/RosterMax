import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';

test.use({ serviceWorkers:'allow' });
test('compensatorios: recarga PWA realmente offline, conserva pendientes y sincroniza una sola vez', async ({ page, context, request }) => {
  test.setTimeout(90000);
  const base = resolve('dist');
  expect(existsSync(resolve(base,'sw.js')), 'Ejecutar build:emulator antes de este recorrido').toBe(true);
  const server = createServer((req,res) => {
    const name = new URL(req.url, 'http://localhost').pathname;
    const path = resolve(base, '.' + (name === '/' ? '/index.html' : name));
    if (!path.startsWith(base + '/') && !path.startsWith(base + '\\')) { res.writeHead(403); res.end(); return; }
    if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', ({ '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json' })[extname(path)] || 'application/octet-stream');
    res.setHeader('Cache-Control','no-store'); res.end(readFileSync(path));
  });
  await new Promise((done) => server.listen(5588,'127.0.0.1',done));
  const errors = [];
  page.on('pageerror',(error) => errors.push(error.message));
  await context.route('**/*',(route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1','localhost'].includes(url.hostname)) return route.continue();
    if (url.hostname.endsWith('.scr.kaspersky-labs.com')) return route.fulfill({ contentType:'application/javascript',body:'' });
    if (url.hostname === 'apis.google.com') return route.fulfill({ contentType:'application/javascript',body:"document.currentScript.dispatchEvent(new Event('error'));" });
    if (url.hostname === 'www.google.com' && url.pathname.endsWith('cleardot.gif')) return route.fulfill({ body:'' });
    return route.abort();
  });
  const documents = 'http://127.0.0.1:8086/v1/projects/demo-rostermax/databases/(default)/documents';
  const entries = async () => {
    const response = await request.post(documents + ':runQuery', { headers:{ Authorization:'Bearer owner' }, data:{ structuredQuery:{ from:[{ collectionId:'compensatory_entries', allDescendants:true }] } } });
    expect(response.ok()).toBeTruthy();
    return (await response.json()).filter((row) => row.document).map((row) => row.document.name);
  };
  try {
    const before = await entries();
    await page.goto('http://127.0.0.1:5588/');
    await page.getByRole('button',{name:'Omitir presentación'}).click();
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
    await page.reload();
    await expect(page.getByRole('region',{name:'Mis compensatorios'})).toContainText('0 días');
    await page.getByRole('button',{name:'Ver historial y registrar'}).click();
    await expect(page.getByRole('dialog').getByText('Aún no registraste compensatorios.',{exact:false})).toBeVisible();
    await context.setOffline(true);
    await expect(page.getByText('Modo Sin Conexión',{exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    for (const name of ['Finanzas','Franco','Ajustes','Roster']) {
      await page.getByRole('navigation').getByRole('button',{name, exact:true}).click();
      await expect(page.getByText('Cargando sección…',{exact:true})).toHaveCount(0);
    }
    await page.getByRole('button',{name:'Ver historial y registrar'}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Registrar días pendientes'}).click();
    await page.getByLabel('Cantidad de días').fill('3');
    await page.getByRole('button',{name:'Guardar movimiento'}).click();
    await expect(page.getByRole('dialog').getByRole('article')).toContainText('3 días pendientes');
    await page.reload();
    await expect(page.getByRole('region',{name:'Mis compensatorios'})).toContainText('pendiente de confirmación');
    await expect(page.getByText('No confirmado por el servidor.', { exact:false })).toBeVisible();
    expect(await entries()).toEqual(before);
    await context.setOffline(false);
    await expect.poll(async () => (await entries()).length, { timeout:35000 }).toBe(before.length + 1);
    await page.getByRole('button',{name:'Ver historial y registrar'}).click();
    await expect(page.getByRole('dialog').getByRole('article')).toContainText('Confirmado por servidor');
    await page.reload();
    await expect(page.getByRole('region',{name:'Mis compensatorios'})).not.toContainText('pendiente de confirmación');
    await expect(page.getByText('Datos privados confirmados por el servidor', { exact:true })).toBeVisible();
    expect((await entries()).length).toBe(before.length + 1);
    expect(errors).toEqual([]);
  } finally { await context.setOffline(false); await page.goto('about:blank'); await new Promise((done) => server.close(done)); }
});
