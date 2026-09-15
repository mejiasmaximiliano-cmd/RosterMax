# Beta 0.5 — herramientas para el día a día

## Cambios

- Calendario mensual con trabajo, franco, licencias y planes por fecha; exportación ICS del mes o próximos 90 días sin motivos privados. Es una copia, no una suscripción.
- Cambios temporales editables: vacaciones, permisos, carpeta médica, trabajo extra y roster especial. Al finalizar se retoma el ciclo original, sin desplazarlo. Máximo 30 intervalos no superpuestos.
- El equipo ve disponibilidad genérica; la carpeta médica y los permisos no se ofrecen como francos para reuniones. Las coincidencias se agrupan y las listas tienen búsqueda/límites visuales.
- Franco: crear, editar, reprogramar, completar, eliminar y buscar planes. Las horas del próximo franco no incluyen tareas de otros períodos ni citas durante licencias.
- Finanzas: presupuestos independientes por mes y moneda, gastos con moneda propia, tratamiento explícito de déficit y metas con aportes validados. El disponible por franco considera únicamente días restantes del mes y los cambios temporales. No es asesoramiento financiero ni conexión bancaria.
- Cada UID tiene una sesión de interfaz separada. El calendario público se publica sólo tras confirmar los tres conjuntos de datos con el servidor; nunca se publica el diagrama inicial por defecto.
- Copia local persistente y cambios privados en cola sin red. La vinculación de compañeros y los aportes a metas necesitan conexión. No se garantiza conservar datos si el navegador elimina el almacenamiento.
- Clima con validaciones, caché y errores visibles; no sustituye información meteorológica de seguridad laboral.
- Métricas voluntarias seudónimas, no un contador de descargas ni una auditoría antifraude. Una impresión requiere 50 % del anuncio visible durante un segundo con la pestaña visible; deduplicación por cuenta, campaña, fecha y sesión de navegador.

## Pruebas locales

Usar Node 22.12+ y Java 21 para Firebase Emulator Suite. No requieren cuenta de Google real ni acceso a los datos de trabajadores.

Terminal 1:

```powershell
npx firebase emulators:start --only auth,firestore --project demo-rostermax
```

Terminal 2:

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8086'
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Si hay Chrome instalado, se puede elegir `$env:PLAYWRIGHT_CHANNEL='chrome'`. Playwright usa perfiles de prueba aislados. Su servidor Vite configura `VITE_USE_EMULATORS=true`; esta opción no se activa en builds de producción. Auth usa 9096 y Firestore 8086. Las pruebas de reglas usan el proyecto separado `demo-rostermax-security`.

## Publicación y límites

Publicar primero el frontend compatible y después las reglas. Las versiones anteriores deben cerrarse y volver a abrirse para recibir el nuevo formato de calendario compartido. Los documentos públicos antiguos se sustituyen al abrir la versión nueva; la migración administrativa permite minimizar también los que todavía no se actualizaron.

Antes de ampliar la beta, comprobar en teléfonos reales Google, invitaciones y recuperación de conexión. La emulación móvil no sustituye pruebas físicas Android/iOS. Las alertas con la app cerrada siguen pendientes de Push. Completar la política/contacto de privacidad y el flujo de eliminación/exportación de todos los datos antes de comercializar ampliamente.

La auditoría de dependencias se realiza por separado para producción y herramientas de desarrollo. No usar `npm audit fix --force` para degradar Firebase CLI ante avisos transitivos.

## Verificación de esta entrega

- 83 pruebas unitarias y de reglas aprobadas, incluyendo 8 escenarios contra Firestore Emulator y 3 de migración.
- 7 recorridos móviles automatizados aprobados en Chrome aislado: separación de cuentas, escritura sin red y reconexión, no publicación del roster inicial, calendario/planes persistentes, licencia y regreso al ciclo, presupuestos ARS/USD por mes, e invitación recíproca con privacidad médica.
- Capturas revisadas y comprobación automática de ausencia de desbordamiento horizontal.
- ESLint, build de producción y compilación de reglas en Firebase aprobados.
- Auditoría de dependencias de producción: 0 vulnerabilidades reportadas. Herramientas de desarrollo: 10 avisos moderados transitivos pendientes, sin avisos altos tras actualizar parches compatibles.
- El build conserva un aviso de tamaño de JS (aprox. 790 kB, 233 kB gzip). La caché PWA evita descargarlo completo en cada apertura; optimizar la división de código requiere conservar también la navegación sin conexión.

Las pruebas no usan Google real ni dispositivos físicos, ni verifican entrega Push con la app cerrada.
