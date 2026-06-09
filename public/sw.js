// public/sw.js
const CACHE_NAME = 'rostermax-v1';

// Al instalar, activamos inmediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Requisito OBLIGATORIO de Chrome para que la PWA sea instalable: Interceptar fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // Lógica de caché offline futura
      return new Response("Estás offline.");
    })
  );
});
