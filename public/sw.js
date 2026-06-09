// public/sw.js - El motor que hace la app instalable
self.addEventListener('install', (e) => {
  console.log('[Service Worker] RosterMax Instalado');
});

// Este evento fetch vacío es el requisito técnico obligatorio de Google y Apple 
// para que el celular active el botón de "Instalar App".
self.addEventListener('fetch', (e) => {});
