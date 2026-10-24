import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

test.use({ serviceWorkers: 'allow' });
test('PWA conserva versión completa ante actualización fallida y dos pestañas', async ({ page, context }) => {
  let version = 'a', fail = false;
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const server = createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.url === '/sw.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(sw.replace('__BUILD_ID__', version)); }
    else if (req.url?.startsWith('/assets/')) {
      if (fail && req.url === '/assets/b.js') { res.writeHead(503); res.end('simulated interrupted deployment'); return; }
      res.setHeader('Content-Type', 'application/javascript'); res.end(`document.body.dataset.version=${JSON.stringify(req.url.slice(8,9))}`);
    } else if (['/manifest.json','/logo.svg','/favicon.svg'].includes(req.url)) { res.end('{}'); }
    else { res.setHeader('Content-Type', 'text/html'); res.end(`<html><body><h1>Local PWA fixture</h1><script src="/assets/${version}.js"></script></body></html>`); }
  });
  await new Promise((resolve) => server.listen(5589, '127.0.0.1', resolve));
  try {
    await page.goto('http://127.0.0.1:5589/');
    await page.evaluate(async () => { await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready; });
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-version', 'a');
    const second = await context.newPage();
    await second.goto('http://127.0.0.1:5589/');
    version = 'b'; fail = true;
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await expect.poll(() => page.evaluate(async () => (await caches.keys()).includes('rostermax-complete-b'))).toBe(false);
    await page.reload(); await second.reload();
    await expect(page.locator('body')).toHaveAttribute('data-version', 'a');
    await expect(second.locator('body')).toHaveAttribute('data-version', 'a');
    fail = false;
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
    await page.reload(); await second.reload();
    await expect(page.locator('body')).toHaveAttribute('data-version', 'a');
    await expect(second.locator('body')).toHaveAttribute('data-version', 'a');
    await page.close(); await second.close();
    const next = await context.newPage();
    await next.goto('http://127.0.0.1:5589/');
    await expect(next.locator('body')).toHaveAttribute('data-version', 'b');
    await context.setOffline(true);
    await next.reload();
    await expect(next.locator('body')).toHaveAttribute('data-version', 'b');
    await context.setOffline(false);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
