# Publicación, configuración y reversión

La autorización del propietario del 24/10/2026 sustituye el cierre local anterior: permite commits, push, integración, frontend y reglas compatibles en producción. El resultado efectivo y los identificadores publicados se registran en `ROSTERMAX_RELEASE_REPORT.md`. No cargar fixtures en producción. El censo sigue siendo una operación manual, no un proceso automático.

## Entrega beta-0.7: procedimiento vigente

1. Fetch y comprobar cambios remotos; conservar auditoría previa. Ejecutar lint, `npm audit --omit=dev` y suite con emuladores demo/loopback.
2. El build de Vercel selecciona explícitamente `node scripts/build-production.mjs` mediante vercel.json. Solo acepta VERCEL_ENV=production; sin Vercel, la compilación local requiere `--production`. Se revisó la configuración web pública existente y se versionó en `config/production.public.json` (no contiene credenciales de servidor). Una variable de Vercel contradictoria detiene la publicación. No hay respaldo silencioso del build genérico ni del modo local a producción; no se necesita crear preview. La preview sigue rechazando destinos productivos.
3. `node scripts/release-production-state.mjs`: lectura agregada de reglas desplegadas y estados de feedback. No cambia nada ni devuelve contenido personal.
4. `npx firebase deploy --only firestore:rules --project rostermax-60242 --non-interactive`. Verificar de nuevo que la huella desplegada coincide con firestore.rules.
5. Compilar con `node scripts/build-production.mjs --production`. Commit de implementación separado, integrar por fast-forward con main actualizado y push normal (nunca force). Vercel ya está conectado a ese repositorio; esperar estado y comprobar `/version.json`, HTML y todos los recursos referenciados. Los pushes solo de reportes/capturas se omiten mediante ignoreCommand; no simular su publicación como un nuevo frontend.
6. `node scripts/diagnose-ceo.mjs --publish`: enumeración completa y actualización exclusivamente del censo agregado. Esta acción CLI no pasa por la interfaz y no genera el evento administrativo de la app; registrarla en el reporte de entrega. Sin credenciales, conservar el último censo e indicar el botón manual que debe usar el propietario.
7. Repetir lecturas de reglas, censo y conteos de feedback; no escribir planes, compensatorios ni fixtures en cuentas reales. Comprobar recursos públicos y ejecución sin mutaciones de backend; OAuth y recorridos con cuentas reales requieren el teléfono del propietario.

## Reversión concreta del frontend (sin revertir reglas ni datos)

Base local anterior comprobada: `44975c7` (incluye aislamiento, compensatorios y vigencias). Ante un fallo crítico, crear una rama desde main y restaurar **solo** `src`, `public`, `index.html`, `vite.config.js`, `e2e` y `tests` desde ese commit con `git restore --source=44975c7 -- ...`. Conservar `config/production.public.json`, `scripts/build-production.mjs`, vercel.json, dependencias actualizadas y **firestore.rules nuevas**. Ejecutar la suite anterior con emuladores y el build production explícito, hacer un commit correctivo e integrarlo/push a main. No volver al frontend 8db6d54, que ignora vigencias; no cambiar IDs, aplanar historial ni borrar IndexedDB. La reversión mantiene el modelo de deudas/entradas, pero la UI anterior no ofrece CSV ni los nuevos detalles visuales.

La PWA puede conservar la versión anterior hasta cerrar **todas** sus ventanas. Antes de cerrar, confirmar escrituras. Si la descarga de un módulo falla, se conserva el worker completo activo, incluido su acceso offline. No usar skipWaiting ni recargar por fuerza.

Las secciones siguientes se conservan como antecedente de la preparación local. Donde mencionan autorización “futura” o preview obligatorio, prevalece el procedimiento vigente de esta entrega.

## Reproducir localmente

1. Node 24, Java 21, `npm ci` y `npx playwright install chromium`. En este equipo se probó Chrome mediante `PLAYWRIGHT_CHANNEL=chrome`; CI utiliza Chromium de Playwright.
2. `npm run lint` y `npm run build:emulator`.
3. `npx firebase emulators:exec --only auth,firestore --project demo-rostermax "npm run test:all"`.
4. El preflight integral exige hosts loopback de Auth/Firestore y proyecto ficticio. `npm test` por separado omite las reglas si no existe FIRESTORE_EMULATOR_HOST: esa ejecución no sustituye el paso anterior.
5. Ver las capturas en `audit/integral/`. Los proyectos de reglas separados también empiezan por `demo-`; solo usan datos ficticios.

## Preparación de publicación

- Revisar el diff con la base `8db6d54eee2c934c651e42e1e7a0233abe3a4875`, el reporte y las reglas. Mantener una copia de las reglas y despliegue actuales para recuperación.
- Configurar **Production** en Vercel con `.env.production.example`, incluida la API key pública del cliente obtenida de la configuración existente de Firebase. No cargar cuentas de servicio, OAuth access tokens ni credenciales CLI en VITE_*.
- Conservar proyecto `rostermax-60242`, namespace `roster-max-production`, dominio `https://rostermax.vercel.app` y aplicación Firebase existentes. No crear otra base de producción ni migrar usuarios.
- Configurar **Preview** con otro proyecto Firebase y namespace, dominio autorizado para Auth y URL de esa preview. Si falta este entorno, aceptar que la preview falle; nunca heredar variables Production para resolverlo. VERCEL_ENV también se comprueba durante el build.
- El registro administrativo protegido existente sigue siendo la fuente del rol propietario. No añadir emails ni UIDs al cliente como autorización. Una entrada `active:false` debe conservarse al revocar un claim hasta haber retirado el claim y sus tokens; borrarla mientras un claim sigue activo rehabilitaría la vía alternativa.
- Completar VITE_PRIVACY_CONTROLLER y VITE_PRIVACY_CONTACT_EMAIL únicamente con información real del responsable. Los plazos y política requieren decisión del propietario y revisión adecuada.
- VITE_CEO_API_URL queda vacío: no se desplegó un servidor CEO. El censo se actualiza **manualmente** con Google e IAM del proyecto.

## Orden de despliegue futuro

1. Aprobar primero las reglas nuevas: admiten documentos compartidos v1 existentes y campos nuevos opcionales. Comando previsto, **no ejecutado**: `firebase deploy --only firestore:rules --project rostermax-60242`.
2. Con variables revisadas y suite verde, autorizar publicación del frontend en Vercel. No publicar la salida `dist` de modo emulator. El build real es `npm run build` con entorno production explícito.
3. Verificar con cuentas de prueba identificadas: Google real, sesión en segundo dispositivo, un vínculo recíproco, retirada/rotación, cuenta normal sin CEO y propietario autorizado. No usar datos personales reales para escrituras de prueba.
4. En CEO, pulsar Actualizar censo con Google y verificar su nueva fecha. Esta operación sí actualizará el snapshot y un evento administrativo; necesita autorización de publicación/operación posterior.
5. Confirmar actividad voluntaria, operaciones sin contenido privado y período/cobertura. La medición nueva no tiene histórico anterior a la publicación y al consentimiento.
6. Probar Android/iOS físicos: instalación, reapertura offline, actualización con dos pestañas y exportación/entrega de recordatorios en Calendar. Cerrar todas las pestañas para activar una actualización PWA que está esperando; no se fuerza una recarga durante escrituras.

## Reversión

- Antes de publicar: descartar únicamente cambios propios mediante revisión del diff; preservar la auditoría y artefactos anteriores del usuario. No usar reset/limpieza destructivos.
- Después de una publicación: preferir revertir el frontend al último **build con validación de entornos**, conservando reglas nuevas de aislamiento, revocación y compensatorios. El bundle anterior sin validación tiene el riesgo P1-01 y no es una reversión segura para previews.
- No reemplazar reglas nuevas por las antiguas después de guardar compensatorios: la antigua regla privada genérica permitiría alterar o borrar ese historial sin la validación nueva. Mantener sus protecciones aunque el frontend oculte el módulo.
- No borrar documentos ni cambiar IDs al revertir UI. Cabeceras/entradas compensatorias y vigencias permanecen almacenadas; el motor antiguo ignora vigencias y puede mostrar el pasado incorrectamente. Ante problemas, suspender edición de diagramas y restaurar un frontend que entienda el historial, no aplanar los datos.
- La PWA conserva versiones completas. Una actualización espera que terminen las pestañas anteriores; no borrar IndexedDB ni colas para forzar la actualización. Si un recurso nuevo falla al descargar, la versión activa anterior queda utilizable.

## Privacidad: atención manual pendiente del propietario

La solicitud de eliminación aparece en Feedback con categoría privacy y estado de atención. No está automatizada y no debe marcarse resuelta antes de ejecutar y comprobar el procedimiento.

Verificar identidad y alcance antes de cualquier borrado futuro. Exportar si el titular lo solicita; retirar primero su compartición; eliminar con herramienta administrativa autorizada todas las subcolecciones privadas (incluidas compensatory_debts, compensatory_entries, operation_receipts y settings), sus documentos públicos propios de actividad/funciones/campañas/códigos y la cuenta Auth. Borrar un documento padre en Firestore no borra automáticamente sus subcolecciones. Revisar feedback, copias administrativas, respaldos y conservación conforme a la política que defina el responsable. No leer notas o montos para realizar un conteo o borrado por ruta. No prometer borrar copias ya exportadas o vistas por terceros. Este procedimiento no se ejecutó sobre ninguna cuenta real.

## Clima y publicidad

Las condiciones consultadas el 24/10/2026 clasifican las apps con anuncios como uso comercial; la API gratuita de Open-Meteo se limita a uso no comercial. Antes de vender anuncios, decidir una licencia/proveedor autorizado o retirar temporalmente el clima. Una API comercial con clave requerirá un mecanismo que no exponga secretos en el navegador. No se contrató ningún plan ni se creó ese servicio.

Fuentes: [Términos de Open-Meteo](https://open-meteo.com/en/terms), [Licencia y planes](https://open-meteo.com/en/pricing). Mantener atribución y volver a revisar las condiciones antes del lanzamiento comercial.
