const CACHE_PREFIX = 'rostermax-';
const CACHE_NAME = `${CACHE_PREFIX}v5`;
const APP_SHELL = ['/', '/manifest.json', '/logo.svg', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL.map((path) => new Request(path, { cache: 'reload' })));
    // Registration happens after the first page load. Precache its production
    // entry files too, because those initial requests were not yet controlled.
    const shell = await cache.match('/');
    const html = await shell.text();
    const assets = [...new Set([...html.matchAll(/(?:src|href)\s*=\s*["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]))];
    if (assets.length) await cache.addAll(assets.map((path) => new Request(path, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function cachedResponse(request) {
  try {
    return await (await caches.open(CACHE_NAME)).match(request);
  } catch {
    // Storage can be unavailable or evicted independently of network access.
    return undefined;
  }
}

async function storeResponse(request, response) {
  if (!response.ok || response.redirected) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Quota/storage errors must not turn a successful request into an outage.
  }
}

function offlinePage() {
  return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RosterMax · Sin conexión</title><body><h1>RosterMax</h1><p>No hay conexión y todavía no se guardó esta versión de la app. Abre RosterMax con internet para prepararla para tu próximo turno.</p><a href="/">Volver a intentar</a></body></html>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.headers.get('Content-Type')?.includes('text/html')) {
          await storeResponse('/', response);
        }
        if (response.status >= 500) return (await cachedResponse('/')) || response;
        return response;
      } catch {
        return (await cachedResponse('/')) || offlinePage();
      }
    })());
    return;
  }

  // Keep runtime caches limited to app assets, not same-origin API responses.
  const isAsset = url.pathname.startsWith('/assets/') || APP_SHELL.includes(url.pathname)
    || ['script', 'style', 'font', 'image', 'manifest'].includes(request.destination);
  if (!isAsset) return;

  const network = fetch(request)
    .then(async (response) => {
      await storeResponse(request, response);
      return response;
    })
    .catch(() => undefined);
  // Keep background refreshes alive and handle rejection even when a cached
  // response has already been returned to the page.
  event.waitUntil(network.then(() => undefined));
  event.respondWith((async () => (await cachedResponse(request)) || (await network) || Response.error())());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const appWindow = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (appWindow) return appWindow.focus();
      return self.clients.openWindow('/');
    }),
  );
});
