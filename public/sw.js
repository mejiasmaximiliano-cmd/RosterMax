const CACHE_PREFIX = 'rostermax-complete-';
// Replaced for each build from its immutable asset names.
const CACHE_NAME = CACHE_PREFIX + '__BUILD_ID__';
const APP_SHELL = ['/', '/manifest.json', '/logo.svg', '/favicon.svg'];
const LAZY_ASSETS = [/*__PRECACHE_ASSETS__*/];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const shell = await fetch(new Request('/', { cache: 'reload' }));
      if (!shell.ok || !shell.headers.get('Content-Type')?.includes('text/html')) throw new Error('Invalid shell');
      const html = await shell.clone().text();
      const assets = [...new Set([...html.matchAll(/(?:src|href)\s*=\s*["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]))];
      if (!assets.some((path) => path.endsWith('.js'))) throw new Error('Missing entry');
      await cache.addAll([...new Set([...APP_SHELL.slice(1), ...assets, ...LAZY_ASSETS])].map((path) => new Request(path, { cache: 'reload' })));
      // HTML is committed only after ALL entry assets are available.
      await cache.put('/', shell);
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error; // The previous complete worker/version stays active.
    }
    // Do not skipWaiting: tabs using the old version finish together.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const previous = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME);
    await Promise.all(previous.slice(0, -1).map((key) => caches.delete(key)));
    await Promise.all(keys.filter((key) => /^rostermax-v\d+$/.test(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function assetFromCompleteCache(request) {
  const own = await (await caches.open(CACHE_NAME)).match(request);
  if (own) return own;
  for (const key of (await caches.keys()).filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)) {
    const response = await (await caches.open(key)).match(request);
    if (response) return response;
  }
  return undefined;
}

self.addEventListener('fetch', (event) => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => (await (await caches.open(CACHE_NAME)).match('/')) || fetch(request))());
    return;
  }
  if (!url.pathname.startsWith('/assets/') && !APP_SHELL.slice(1).includes(url.pathname)) return;
  event.respondWith((async () => (await assetFromCompleteCache(request)) || fetch(request))());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const window = clients.find((client) => new URL(client.url).origin === self.location.origin);
    return window ? window.focus() : self.clients.openWindow('/');
  }));
});
