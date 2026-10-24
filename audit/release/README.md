# Evidencias de beta-0.7 — 24/10/2026

Todas las imágenes de paneles de esta carpeta se generan **localmente**, con Auth/Firestore en emuladores `demo-rostermax`, cuentas ficticias y Chrome automatizado. No son capturas de la cuenta real ni una validación de OAuth o dispositivos físicos.

El panel CEO puede mostrar **150/146/4** porque `e2e/ceo-audience.spec.js` crea ese snapshot ficticio; otras pantallas reutilizan la base de emuladores. Eso no contradice el censo administrativo de producción **185/181/4**, cuya fecha/fuente se documenta en el reporte. No interpretar ninguna cifra, comentario, nombre ni movimiento de estas capturas como datos reales.

`e2e/integral.spec.js`: Roster, Equipo, Franco, Finanzas, Ajustes, CEO y Compensatorios a 390, 768 y 1440 px. Configuración sintética 14×14 con subida 01/10/2026: el 24/10 es franco 10/14, del 15 al 28 y próxima subida el 29. No modifica la configuración del propietario.

`e2e/release-local.spec.js`: claro/oscuro a 390 px, montos grandes ficticios, captura de navegación a altura real y diálogo a 420 px de altura. Reducir el viewport aproxima el espacio disponible con teclado, **no** prueba un teclado físico Android/iOS. En capturas completas, los encabezados sticky pueden aparecer a mitad de la imagen por el desplazamiento y el ensamblado de Playwright: contrastar con `navegacion-*.png`, que captura el viewport real.

`initial-load-local.json`: tres contextos fríos, loopback, sin throttling y sin worker para aislar la carga inicial. No es velocidad móvil ni Core Web Vitals de producción. Los archivos diferidos sí se precargan en la caché PWA completa, comprobada aparte por `offline-pwa.spec.js` y `pwa-update.spec.js`.

El informe final distingue estas pruebas locales de las comprobaciones HTTP reales, reglas efectivamente desplegadas y actualización administrativa real del censo. No se cargaron fixtures en producción.
