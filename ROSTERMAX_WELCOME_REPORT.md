# RosterMax — bienvenida, ayuda y correcciones beta-0.8

## Resumen para el propietario

Entrega incremental, sin reescritura: cinco historias interactivas con ejemplos ficticios, ayuda permanente con 20 preguntas, comprobación verificable de versiones, confirmaciones claras para compartir y cobertura explícita del CEO. Modo claro inicial solo cuando no existe preferencia; oscuro sigue disponible. La narración no está integrada: faltan cinco grabaciones revisadas; toda la experiencia funciona sin sonido.

**Publicada y comprobada:** [https://rostermax.vercel.app/](https://rostermax.vercel.app/), **beta-0.8**, commit `21bed255483ec8533a4703d1ea8e9a56a75c6236`, build público `8f13a2998e55e6fa5900`. Publicación Vercel correcta y comprobación pública del 24/10/2026, 17:31 UTC. Las capturas funcionales locales no se presentan como una sesión real de producción.

## Procedencia y conservación

- Repositorio: `mejiasmaximiliano-cmd/RosterMax`; rama de trabajo `codex/welcome-help-updates`.
- Base local y remota inspeccionada: `f6a413652caa0448582e845783eedc3e168ba26f` (documentación). Frontend público inicial: beta-0.7, `ba44304ba29c0d14efc8c91487fd09637a0b73a9`, build `f5b6a567ef6bf7e4519b`.
- Se conservaron la auditoría y las evidencias originales sin seguimiento. No se hallaron instrucciones AGENTS.md aplicables fuera de dependencias; se reutilizaron auditoría, informe integral y runbook existentes.
- React 19, Firebase JS, Vite 8, Tailwind y Playwright; sin cambios de dependencias en esta entrega.
- Las pruebas que escriben usan exclusivamente Auth/Firestore locales del proyecto ficticio `demo-rostermax`. No crean cuentas, documentos, compensatorios, compañeros ni campañas en producción.
- Lectura agregada real, 24/10/2026 17:19 UTC: cuatro comentarios, los cuatro resueltos; ningún estado se cambió para probar. Reglas desplegadas iguales a las locales, SHA-256 normalizado `6ccbeacc7c57ad1ded8957e3e383caca08d808ec5ba9630e87a1152033ed5e03`, ruleset `ce318a10-bd90-4082-965e-35605e9f385a`. Esta entrega no necesita cambiar ni desplegar reglas.

## Cambios implementados

### Presentación y bienvenida

`WelcomeStories.jsx`, `welcomeState.js` y `helpContent.js`: historias manuales de calendario, coincidencias, planes, compensatorios y presupuesto. Cada ejemplo está identificado como demostración y cambia solo estado de interfaz; el ejemplo de compensatorios conserva los dos saldos y no toca el motor del calendario. El presupuesto usa el cálculo existente.

Progreso, avance/retroceso, omitir, cerrar, flechas, Escape y foco nativo de diálogo; controles de avance fijos dentro del diálogo y cuerpo desplazable. Movimiento reducido desactiva transiciones. Ya tengo cuenta usa el flujo existente. Finalizar abre la configuración existente si falta diagrama, o calendario/invitación pendiente según corresponda. Reabrir no escribe configuración. La decisión de nuevo usuario espera información de cuenta/configuración; recibo de presentación local por cuenta y entorno. Usuarios existentes reciben una invitación discreta, no una apertura obligatoria en cada actualización.

Tema claro por defecto y por sesión de carga; preferencia guardada recuperada desde la cuenta y copia local por UID. No se escriben preferencias durante la carga. Se conserva el tema anterior si falla un cambio explícito. No había una opción Seguir al sistema en el código de base; no se inventó una ni se alterna automáticamente. Diálogos, ayuda, historias y estado de sesión adoptan el tema activo. Se ajustaron colores claros de texto de estado para legibilidad.

### Ayuda permanente

Desde Ajustes, sin pestaña principal adicional: Conocé RosterMax, Preguntas frecuentes y Reportar un problema mediante el feedback existente. Veinte respuestas agrupadas y desplegables, con accesos de navegación y retorno. Enlaces contextuales junto a sincronización, compartir, compensatorios y versiones.

Respuestas contrastadas con el código: código global reenviable, quitar de lista no revoca, compensatorios independientes, CSV con revisiones, presupuesto estimado por moneda, Google sin fusión automática, eliminación de cuenta manual, límites offline y avisos externos/ICS. No se promete Push ni borrado instantáneo. La ayuda del CEO permanece dentro del panel protegido.

### Actualizaciones comprobables

`updateChecker.js` distingue comprobando, última versión con hora, descarga, lista, disponible sin descarga confirmada y error. Solicitar `registration.update()` no equivale a terminar la descarga; se comprueba el identificador del worker en espera/activo por mensaje. Un fallo nunca se convierte en «actualizado».

Se observó que el manifiesto estático podía llegar desde CDN con `Age: 15073`, incluso pidiendo no usar caché. Por eso se agregó **solo** `GET /api/version`, función pública mínima en el Vercel existente: lee el manifiesto del build, devuelve nonce de solicitud y hora del servidor, sin cuentas, credenciales, Firebase, escrituras ni trabajos programados. El cliente rechaza caché con antigüedad, nonce incorrecto, formato o entorno inválido. La prueba posterior a publicación debe verificar también el empaquetado de `dist/version.json` de esta función.

Se conserva la actualización PWA completa/atómica existente: no hay skipWaiting, recarga forzada ni borrado de caché/IndexedDB. Si está lista, sincronizar primero y cerrar todas las ventanas de ese navegador/dispositivo antes de reabrir. No se exige cerrar la app en otros teléfonos.

### Compartir y CEO

Compartir mi roster → Dejar de compartir con todos abre un diálogo accesible que explica código global, conservación de datos/lista, copias anteriores y nuevo código al reactivar. Cancelar no escribe. El estado de acceso solo se da por confirmado tras servidor; si hay error se reconcilia con la configuración real, o se muestra estado no confirmado. Publicación del roster se pausa durante la operación. Quitar un compañero usa otro diálogo que lo identifica y aclara expresamente que no revoca su acceso.

El CEO muestra cuentas medidas únicas antes de filtros, excluidas e incluidas, tanto para actividad como uso de funciones (en su período). Solo se excluyen identificaciones explícitas presentes, sin cifras constantes. Distingue muestra originalmente vacía de muestra vaciada por filtros. No modifica censo, consentimiento ni permisos administrativos.

## Validación

Validación final local sobre `21bed255483ec8533a4703d1ea8e9a56a75c6236`, integrado por fast-forward en main y enviado sin force. El resultado público se documenta por separado abajo.

| Control | Resultado final |
| --- | --- |
| `npm run lint` | Aprobado, código de salida 0 |
| `npm run test:all`, Auth/Firestore locales | **150/150** pruebas de lógica/reglas; **30/30** recorridos de interfaz (3,2 min); cero omitidas, canceladas o pendientes en esas suites |
| Reglas dentro de las 150 | 19 pruebas con emulador, incluyendo CEO/claims/revocación, aislamiento entre usuarios y privacidad de compensatorios |
| Build explícito `node scripts/build-production.mjs --production` | Aprobado; beta-0.8 y SHA exacto anteriores; proyecto/namespace productivos preservados |
| Escritorio/tablet/móvil | 390, 768 y 1440 px; claro/oscuro equivalentes, viewport reducido para formularios, sin desbordes horizontales |
| Regresiones | Sesiones por UID, invitados, invitación recíproca, offline y sincronización sin duplicados, CSV/revisiones, vigencias, calendario/ICS, planes, metas, presupuestos por moneda, clima/simulador |
| Bienvenida y FAQ | Nueve recorridos nuevos: nuevo/existente, invitación pendiente antes y después de configurar, omitir/cerrar/reabrir, foco/flechas/Escape/movimiento reducido y todos los destinos de FAQ |
| PWA y versiones | Actualización fallida/dos pestañas con worker real local; estados del comprobador con worker controlado; API de versión con nonce, errores y cabeceras; sin activación ni recarga forzadas |
| Compartir | Cancelar sin escrituras; rechazo atómico conserva estado real; quitar de lista no revoca; retirada/rotación global y denegaciones en emulador |
| CEO | Acceso normal denegado/propietario ficticio permitido; última lectura válida ante error; antes/excluidas/incluidas, períodos, duplicados y muestra vacía por filtros |
| CI Linux del commit publicado | **Aprobado**: lint, build de emulador, auditoría productiva sin avisos, 150/150 lógica/reglas y 30/30 interfaz (3,0 min), cero omitidas; ejecución `40116407506` |

- Primer recorrido de integración: 26/28 aprobados, dos fallos de pruebas antiguas (mensaje CEO/datos ficticios heredados y botón antiguo del onboarding). Se aislaron datos locales y adaptaron expectativas; repetición dirigida 12/12 y suite final completa 30/30. No se ocultaron fallos ni se presentaron como una pérdida de medición real.
- Lint: aprobado en la revisión actual.
- `npm audit --omit=dev`: cero vulnerabilidades.
- Auditoría completa: seis avisos moderados de herramientas de desarrollo (firebase-tools y transitivas); no incluidos en frontend ni en la función de versión, que solo usa Node nativo. No se aplicó fix --force ni degradación sugerida. Permanecen como deuda de herramientas.
- Build advierte bundle inicial superior a 500 kB; no se afirma una mejora de velocidad. Ayuda y módulos secundarios existentes permanecen separados y precacheados, conservando acceso offline.
- Build productivo local: bundle principal 1.071,92 kB minificado / 318,43 kB gzip, más runtime, iconos y CSS. Bundle principal servido por Vercel: 1.073.254 bytes; los hashes del build local y remoto difieren, pero cada manifiesto y worker identifica de forma consistente su propio build del mismo commit. La medición de tres contextos fríos locales (DOMContentLoaded 139,6 / 140,9 / 141,2 ms) queda en `audit/welcome/regression/initial-load-local.json`; no equivale a rendimiento móvil real ni permite afirmar mejoras de velocidad.

### Evidencias y límites

`audit/welcome/`: mismas fechas ficticias, dimensiones y datos en pares claro/oscuro; historias a 390 px, FAQ a 768/1440 px, cobertura CEO ficticia y estado de actualización controlado. `regression/` conserva evidencia de calendario, finanzas, compensatorios y paneles existentes. Las capturas de pruebas no son datos reales del propietario ni validación de una sesión productiva.

Capturas principales: [bienvenida clara](audit/welcome/historia-1-light-390.png), [compensatorios demo claros](audit/welcome/historia-4-light-390.png), [FAQ clara 1440](audit/welcome/faq-light-1440.png), [diálogo global](audit/welcome/compartir-global-light-412.png). Comparaciones equivalentes: [bienvenida oscura](audit/welcome/historia-1-dark-390.png), [compensatorios demo oscuros](audit/welcome/historia-4-dark-390.png), [FAQ oscura 1440](audit/welcome/faq-dark-1440.png). Las capturas adicionales de diálogos, CEO y actualización usan el viewport predeterminado Pixel 7 de 412 × 839, correctamente identificado; las pruebas principales de 390/768/1440 no se sustituyen por estas. Índice y límites en [README de evidencias](audit/welcome/README.md).

La comprobación pública usa GET reales de HTML, manifiesto, función de versión, worker y todos los recursos del precache. Ejecuta el frontend público con Auth interceptado **antes** de crear invitados: la captura de error de sesión es intencional, no una caída de producción. No prueba OAuth Google real, cuenta real del CEO, navegación autenticada productiva ni recepción física de notificaciones. Navegación autenticada, aislamiento y operaciones se prueban con emuladores.

Narración: pendiente por falta de herramienta y grabaciones revisadas. Guiones y punto de integración en `docs/WELCOME_NARRATION.md`. No se muestran controles de audio. No se probaron descargas de audio ni se declara escuchada una locución inexistente.

## Publicación y reversión

### Comprobación efectiva de esta entrega

- [Vercel](https://vercel.com/mejiasmaximiliano-3306s-projects/roster-max/3Z7i5m5kKnAFCkqdARuJkQTA8Syw): estado `success` para el commit publicado.
- `/version.json` y `/sw.js`: beta-0.8, SHA esperado y build `8f13a2998e55e6fa5900`; función `/api/version` efectivamente empaquetada y operativa, con nonce exacto y hora nueva del servidor.
- `scripts/verify-public-release.mjs`: HTML 200, once recursos JS/CSS del precache comprobados, caché PWA completa del build publicado, cero errores inesperados de ejecución o red pública. CEO y compensatorios sin sesión: HTTP 403. **Cero escrituras de producción**; Auth interceptado deliberadamente antes de crear invitado.
- Lectura agregada posterior, 17:31:42 UTC: mismas reglas/ruleset/hash que antes y cuatro comentarios resueltos conservados. Sin cambios de reglas, roles, namespace, roster, finanzas, compensatorios, códigos ni preferencias reales.
- Evidencia verificable: [production-check.json](audit/welcome/production-check.json) y [conservación de reglas/comentarios](audit/welcome/production-preservation.json).
- [CI remoto](https://github.com/mejiasmaximiliano-cmd/RosterMax/actions/runs/40116407506) del mismo SHA: `success`, finalizado a las 17:34:25 UTC. Logs revisados: 150 aprobadas, cero fallidas/omitidas y 30 recorridos aprobados. Evidencia adicional en su artefacto `isolated-test-evidence` (`12569340538`).
- El commit de cierre contiene informe/capturas y una corrección de nombres de archivos de evidencia a 412 px en el test; no cambia el frontend publicado. Se repitieron sus tres recorridos afectados y lint. Las instrucciones de Vercel omiten esa publicación sin cambios de código operativo; el manifiesto sigue identificando `21bed25`, no el commit documental posterior.

### Procedimiento reproducible

1. Verificar main remoto, conservar cambios posteriores y ejecutar lint/suite sobre el código final. Compilar con `node scripts/build-production.mjs --production`; nunca publicar `dist` de emuladores.
2. Commit de implementación en rama dedicada, integrar por fast-forward y push normal a main. Vercel ejecuta el build explícito, validando variables contra la configuración pública existente. Mantener proyecto y namespace productivos; sin cambios de reglas o datos privados.
3. Verificar estado de Vercel/CI y ejecutar `node scripts/verify-public-release.mjs <SHA>`: commit/entorno/build reales, nonce del endpoint nuevo, precache completo, denegaciones sin sesión y ausencia de errores inesperados. Volver a comprobar reglas/comentarios con `node scripts/release-production-state.mjs` (solo lectura).
4. Reversión concreta: `git revert 21bed255483ec8533a4703d1ea8e9a56a75c6236` sobre main actualizado y `git push origin main`. Eso restaura el código beta-0.7 y retira la función nueva; conservar las reglas desplegadas y todos los datos. Nunca revertir compensatorios, revocación o vigencias ni restaurar snapshots de datos. Confirmar el nuevo SHA servido. Alternativa operativa: rollback del despliegue Vercel beta-0.7 conocido (`ba44304ba29c0d14efc8c91487fd09637a0b73a9`), con comprobación posterior; no requiere tocar Firebase. El nuevo comprobador no estará disponible tras esa reversión del frontend.

## Recibir la actualización sin perder datos

Con conexión, esperar «Datos privados confirmados por el servidor». En Ajustes, comprobar actualización. «Descargando» no es «lista». Al indicar lista, cerrar todas las pestañas y ventanas de RosterMax de ese navegador/dispositivo, incluida la PWA; después abrir otra vez. Si quedan escrituras pendientes, esperar/reintentar la sincronización antes de cerrar. No desinstalar, borrar almacenamiento ni limpiar IndexedDB/caché para actualizar. Ante error de comprobación conservar la versión utilizable y reintentar con conexión.

Si todavía está abierta beta-0.7, su botón puede no mostrar el resultado nuevo: pedí la comprobación con conexión, permití que termine la descarga mediante el mecanismo existente y cerrá/reabrí todas sus ventanas. La indicación detallada de estados aparece al cargar beta-0.8. Si no llega, conservar datos y comunicar la versión visible; no intentar solucionarlo borrando almacenamiento.

## Recorrido breve en el teléfono del propietario

1. Confirmar Google y los datos habituales, sin cerrar una sesión invitada con cambios pendientes.
2. Ajustes → Conocé RosterMax: avanzar, volver, omitir y reabrir; los datos y el diagrama no deben cambiar. Ya tengo cuenta solo aparece cuando corresponde a una sesión invitada.
3. Abrir FAQ, desplegar una respuesta, ir a la función y volver. Revisar ambos temas mediante elección propia, sin modificarla para producir capturas.
4. Comprobar versión; ver hora o error según la conexión. Si está lista, seguir el procedimiento seguro anterior.
5. Abrir Dejar de compartir con todos y **Cancelar**, sin confirmar con el código real. Deben mantenerse código, compañeros y acceso. Leer el alcance global.
6. En CEO revisar antes/excluidas/incluidas y la distinción entre censo manual y actividad voluntaria. No esperar que el filtro cambie el censo ni que aparezcan usuarios sin consentimiento en la muestra.
7. Revisar calendario, Equipo, Finanzas y compensatorios existentes. Las pruebas de crear/corregir/anular o desconectar/reconectar deben hacerse en una cuenta ficticia separada, nunca cargando fixtures en la cuenta real.
