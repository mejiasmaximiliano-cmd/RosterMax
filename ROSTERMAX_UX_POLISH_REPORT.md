# RosterMax — pulido UI/UX y preparación del piloto

## Resumen para el propietario

Entrega incremental **beta-0.9.2**: próxima subida/bajada y ciclo visibles junto al calendario; navegación inferior opaca; compensatorios más compactos; gastos antes de editar el presupuesto; filtros, acciones y mensajes más claros. Una edición sin guardar se puede conservar o descartar sin confundirla con anular un registro. El guardado local no se presenta como confirmación del servidor.

**Publicada y comprobada:** [rostermax.vercel.app](https://rostermax.vercel.app/), beta-0.9.2, commit `e8e8f8612a785547701c9fb58658e2b859ead0c9`, build público `bc3424993a10da2ad40e`. Rama inicial `codex/ux-polish-pilot` y ramas correctivas integradas en main sin reescribir historia compartida. **Validación local y CI final aprobadas: 155 pruebas de lógica/reglas y 36 recorridos de interfaz, sin omisiones.** CI valida bae43e9, que solo corrige dos esperas de pruebas y no cambia el código de aplicación publicado. La comprobación pública y sus límites se detallan abajo.

Guías listas: [prueba con 5–10 compañeros](docs/UX_PILOT.md) y [atención de feedback/privacidad](docs/SUPPORT_PLAYBOOK.md). No se contactó a compañeros ni se realizó investigación con usuarios reales; las comprobaciones automáticas no sustituyen ese piloto.

## Estado inicial y conservación

- Se inspeccionaron README, instrucciones aplicables, último informe y runbook; no había AGENTS.md del proyecto/ancestros. Base local/remota `060833d0374e52a26481c36e547acb8acbb23808`. Producción inicial beta-0.8, commit `21bed255483ec8533a4703d1ea8e9a56a75c6236`, build `8f13a2998e55e6fa5900`. Fetch posterior confirmó la misma base remota antes de integrar.
- Auditoría original `ROSTERMAX_AUDIT_REPORT.md` y `audit/2026-10-24/` preexistentes sin seguimiento: conservadas, no incorporadas al commit ni sobrescritas.
- React 19, Firebase JS, Vite 8, Tailwind y Playwright existentes; sin dependencias nuevas, reescritura ni nuevas pestañas/funciones de negocio.
- Sin cambios en reglas, permisos, autorización CEO, consentimiento, motores de cálculo, monedas, IDs, documentos compartidos, vigencias ni contratos de sincronización. No se migran datos. Compensatorios siguen siendo privados e independientes del calendario, coincidencias, finanzas, avisos y exportaciones de roster.
- Se conserva tema por cuenta, claro inicial sin preferencia, oscuro y tonos de beta-0.8. No se cambió el tema del propietario para producir capturas. Historias, FAQ y actualización segura conservan sus recorridos existentes.
- Todas las escrituras de prueba se limitaron a emuladores loopback `demo-rostermax`; no se modificaron códigos, compañeros, movimientos ni cuentas reales. La lectura agregada productiva se distingue expresamente de las capturas ficticias.

Los problemas concretos y la evidencia previa a editar están en [UX_POLISH_FINDINGS.md](docs/UX_POLISH_FINDINGS.md).

## Cambios realizados

### Jerarquía, controles y navegación

`src/index.css`, `BottomNav.jsx`, `SyncStatus.jsx`: títulos de página de 24 px, secciones de 16 px, espaciado/radios coherentes y clases pequeñas para botones, campos, errores y estado. Acciones principales verdes; secundarias con borde; destructivas con texto explícito y estilo separado. Campos de 16 px y controles principales de al menos 44 px; navegación de al menos 48 px, nombres accesibles y `aria-current`.

La barra inferior ya no tiene transparencia ni depende del contenido que queda detrás. Conserva las cinco pestañas y CEO solo cuando lo permite el mecanismo protegido existente. Padding inferior más área segura permite desplazar el último control visible por encima de la barra. El encabezado refluye con texto al 200 % en 320 px sin agrandar logo/avatar ni desbordar. La bitácora permite encoger el campo dentro de su fila sin reducir el botón; el título del calendario admite reflujo y Planificar usa el botón principal de 44 px.

No se modificaron variables globales de color. Se retiró únicamente la transición global de color de 500 ms del contenedor: al cambiar el tema, fondo y texto pasan juntos al nuevo estado; se evita un intervalo con texto oscuro sobre una tarjeta ya oscura. Las transiciones de historias y movimiento reducido se mantienen. Ajustes puntuales: fondo sólido blanco / `#020617` de navegación; principal blanco sobre el verde existente `#047857`; secundarios slate; destructivo/error `#be123c` sobre `#fff1f2` en claro y `#fecdd3` sobre `#4c0519` en oscuro. Se evita aclarar/oscurecer toda la aplicación para corregir un botón. Etiquetas T/F/L y nombres accesibles del calendario conservan los significados además del color.

### Roster

`RosterCalendar.jsx` recibe los resultados ya calculados: estado de hoy, día del ciclo y próxima transición dentro de la tarjeta principal, antes de la cuadrícula. Al elegir otra fecha, «Consultando…» queda separado de «Hoy». Si se consulta hoy, no se repite el mismo ciclo bajo el calendario. Planificar usa la fecha seleccionada; no altera el motor.

Comparación guardada a 390×844, fecha local fija 24/10/2026 y mismo diagrama ficticio 14×14: próxima subida pasa de **1291 a 277 px** desde el inicio, 1014 px más arriba. La tarjeta del calendario crece de 749 a 874 px porque incorpora hoy/transición y un botón táctil de 44 px; no se achican las celdas para fingir una pantalla más compacta. La captura inicial muestra un aviso pendiente durante la carga y la final confirmación; por eso esta comparación describe ubicación/jerarquía, **no tiempos de sincronización ni velocidad**.

Caso conservado: 24/10 = franco día 10 de 14; período completo 15–28/10; próxima subida 29/10. Una consulta al 30/10 muestra trabajo día 2 de 14 sin cambiar el estado de hoy. Una carpeta médica no se etiqueta como franco. El resumen de compensatorios conserva ambas direcciones y acceso al historial con menor altura; clima, transporte estimado, cambios temporales e históricos/bitácora permanecen secundarios y accesibles.

### Equipo, Franco y Finanzas

- **Equipo:** compañeros antes de «Añadir compañero». Leyenda manual/vinculado desplegable una sola vez, sin repetir párrafos por tarjeta; carga manual no simula una fecha de publicación. Datos compartidos no disponibles se distinguen de no tener coincidencias; fecha de actualización solo cuando existe una publicación fiable. Confirmaciones de quitar/dejar de compartir y alcance global intactos.
- **Franco:** una acción principal «Nuevo plan»; filtros con reflujo, no una franja que obliga a desplazarse horizontalmente. Vacíos específicos para búsqueda, pendientes, completados, atrasados y franco. Se mantienen período completo, días restantes y aclaración de si incluye hoy. Error cerca de guardar y borrador conservado si falla.
- **Finanzas:** resumen → registrar gasto/movimientos → edición desplegable de presupuesto → metas. Monedas y cifras completas, sin dividir los dígitos; a tamaños extremos, desplazamiento del importe dentro de su contenedor en lugar de desbordar la página. Disponible sigue siendo estimado y no bancario; se conserva el vacío sin gastos. Presupuesto, ahorro previsto y aportes reales no se fusionan ni convierten. Las fórmulas son las anteriores.

### Compensatorios y formularios

Saldos separados, medios días, parciales, filtros, CSV y trazabilidad existentes conservados. Registrar/compensar/corregir se distinguen de anular; «Cancelar edición» no anula deuda. Historial y detalles siguen desplegables y accesibles. Intentos fallidos muestran error sin presentarse como sincronizados.

`formGuard.js`, `DiscardChanges.jsx` y `Modal.jsx` agregan protección de borradores transitoria, sin persistir nuevos datos: cerrar/navegar, incluido el asistente de configuración, avisa solo si cambiaron campos, incluso controlados sin atributo name; volver al valor original deja de avisar. Guardar conserva la referencia de lo enviado sin borrar una edición posterior. Un envío que ya comenzó muestra «Guardado en curso», no una falsa opción para cancelar esa escritura.

El estado ocupado pertenece al formulario que realmente envía, no a un contador global de escrituras. Cambiar el consentimiento no deja el perfil o el diagrama falsamente ocupados; el estado ARIA anterior se restaura al terminar. Las pruebas distinguen una tarjeta que ya apareció localmente de un formulario cuyo envío terminó.

En beta-0.9.2, los editores de planes y compensatorios fijan su referencia inicial antes del primer pintado, únicamente al abrir o reemplazar el borrador. La confirmación de descartar deja de ejecutar una limpieza global en un cuadro futuro. Así, un cuadro demorado no puede tratar como guardado lo que se escribió después. La regresión detiene/libera cuadros: falla con el marcado diferido anterior y pasa con la corrección; no se agregó una espera artificial para esconder el problema.

La regresión de reconexión detectó que la confirmación tardía de un guardado offline podía sobrescribir la referencia de un formulario ya vaciado y disparar un falso descarte. Se corrigió: la aceptación local se marca una sola vez; su posterior confirmación no vuelve a marcar el viejo borrador. Prueba explícita de gasto offline y navegación posterior sin falso diálogo.

Los formularios preservan texto ante errores y muestran progreso/controles deshabilitados. Se mantiene la deduplicación existente; feedback, carga manual de compañeros y bitácora suman bloqueo inmediato de doble envío sin cambiar sus esquemas. Tienen progreso, etiquetas visibles/accesibles y conservan una edición posterior al envío en lugar de vaciarla. La prueba verifica un único gasto, comentario, compañero y nota ante doble envío. El resultado local del formulario remite al indicador superior, evitando un «pendiente» estático que contradiga la posterior confirmación. No se promete recuperación de un borrador que todavía no fue guardado después de cerrar el navegador.


La segunda CI detectó además una carrera real de persistencia de compensatorios al recargar inmediatamente después del saldo optimista. El intento estaba en localStorage, pero la mutación todavía podía no haber llegado a IndexedDB; al volver online quedaba como intento con error, sin duplicarse ni inventar un saldo confirmado. **Corrección beta-0.9.1 en useCompensatories.js:** los saldos se presentan desde los snapshots existentes del SDK, no desde el estado optimista adelantado. Al guardar offline, una suscripción temporal al documento privado del mismo evento espera su snapshot local con escritura pendiente (o la confirmación real del batch) antes de cerrar el formulario. Se libera al terminar. No cambia payload, lote, IDs, formato de outbox, reglas ni cálculo; no reconstruye ni reenvía movimientos antiguos automáticamente ni envía métricas por la mera aceptación local. Los intentos antiguos con error se conservan para revisión/reintento con su ID, no se descartan. El recorrido de recarga/reconexión pasó **tres repeticiones dirigidas seguidas** y se volvió a incluir en la suite completa final.

### Ajustes, ayuda y CEO

Cuenta: «Cuenta guardada con Google» describe el vínculo, no una garantía ni el estado de sincronización. El indicador distingue guardado en dispositivo, pendiente, copia sin comprobación reciente, error y sincronizado confirmado. Ayuda/feedback y exportación/privacidad siguen accesibles. Se revisaron textos visibles principales con voseo; historias siguen opcionales, sin reiniciar datos.

CEO conserva fuente, período, última actualización, antes/excluidas/incluidas y advertencias. Se priorizan audiencia y operaciones/feedback; resumen de campañas y nueva campaña quedan después. Explicación de protección desplegable dentro del panel. No se alteran consultas, muestra, censo, exclusiones ni medición para mejorar su apariencia; el censo sigue manual.

## Evidencia visual

**Local con datos ficticios, no sesión de producción del propietario.** Misma cuenta ficticia, fechas, datos y dimensiones para la comparación principal y los dos temas. Diagrama 14×14 desde 1/10/2026; compañero manual 7×7 desde 15/10; otro vínculo sin datos disponibles; plan familiar 25/10; ingreso ARS 2.500.000, fijos 700.000, ahorro previsto 200.000 y gasto 35.000 → disponible estimado 1.565.000. Los escenarios de regresión adicionales están separados de esta comparación.

| Estado, 390×844 | Antes beta-0.8 | Después beta-0.9.2 |
| --- | --- | --- |
| Roster claro | [captura](audit/ux-polish/before/roster-light-390.png) | [captura](audit/ux-polish/after/roster-light-390.png) |
| Roster oscuro equivalente | [captura](audit/ux-polish/before/roster-dark-390.png) | [captura](audit/ux-polish/after/roster-dark-390.png) |
| Equipo claro | [captura](audit/ux-polish/before/equipo-light-390.png) | [captura](audit/ux-polish/after/equipo-light-390.png) |
| Franco claro | [captura](audit/ux-polish/before/franco-light-390.png) | [captura](audit/ux-polish/after/franco-light-390.png) |
| Finanzas claro | [captura](audit/ux-polish/before/finanzas-light-390.png) | [captura](audit/ux-polish/after/finanzas-light-390.png) |
| Ajustes claro | [captura](audit/ux-polish/before/ajustes-light-390.png) | [captura](audit/ux-polish/after/ajustes-light-390.png) |
| CEO ficticio claro | [captura](audit/ux-polish/before/ceo-light-390.png) | [captura](audit/ux-polish/after/ceo-light-390.png) |

Más evidencia: [Roster 412](audit/ux-polish/after/roster-light-412.png), [escritorio 1440](audit/ux-polish/after/roster-light-1440.png), [error junto al gasto, 412](audit/ux-polish/after/error-gasto-light-412.png), [altura reducida clara](audit/ux-polish/after/formulario-altura-reducida-light-390.png), [oscura](audit/ux-polish/after/formulario-altura-reducida-dark-390.png), [compensatorios](audit/ux-polish/regression/compensatorios-390.png). Historias y FAQ equivalentes: [carpeta de regresión](audit/ux-polish/welcome-regression/).

Las capturas principales son **de viewport**, no páginas completas: prueban que el texto detrás de la barra era una transparencia real. Algunas capturas de regresión largas incluyen la barra fija una sola vez; no se usan para diagnosticar solapamientos. La prueba desplazó el último control realmente visible, excluyendo formularios dentro de details cerrados, antes de medirlo frente a la barra.

Contraste calculado sobre colores renderizados/compuestos, [resultados](audit/ux-polish/after/contrast.json): principal 5,48:1 en ambos temas; secundario 9,90 / 11,87; destructivo 5,72 / 11,08; día de calendario seleccionado 7,23 / 11,82. El estado muestreado también supera 4,5:1. No equivale a una certificación de accesibilidad de todas las pantallas, estados hover o herramientas asistivas.

## Verificaciones y límites

Validación local final sobre **`bae43e95c2967f6834fc3bdae5aba4c3ec0f79a7`**, sin editar archivos durante la ejecución. Es un commit exclusivamente de pruebas: `git diff e8e8f86 bae43e9 -- src public scripts config api index.html package.json package-lock.json vite.config.js vercel.json firestore.rules` no devuelve diferencias. El frontend publicado sigue siendo `e8e8f86`; no se presenta el commit de pruebas como un nuevo despliegue.

| Control | Resultado |
| --- | --- |
| `npm run lint` | Aprobado, salida 0 |
| `npm run test:all`, Auth/Firestore locales | **155/155** lógica/reglas y **36/36** interfaz (3,8 min); cero omitidas, fallidas, canceladas o pendientes en esta ejecución final |
| Reglas dentro de las 155 | **19** pruebas reales de emulador, no omitidas |
| `node scripts/build-production.mjs --production` | Aprobado, salida 0; beta-0.9.2, commit de verificación bae43e9, build local `699bb592fd112ae55e3e`. El build anterior del fuente e8e8f86 también aprobó (`74e4780c48f998fd3e5d`); no se confunden con el artefacto público |
| `npm audit --omit=dev` | Aprobado, cero vulnerabilidades |
| Diff de motores/reglas/configuración | Sin cambios; árbol de código idéntico al commit al terminar |
| GitHub Actions y Vercel | **Ambos aprobados**; commit servido confirmado, CI 155 + 36 sin omisiones; ver cierre público abajo |

- Cobertura conservada: 155 pruebas de lógica/reglas, incluidas 19 de emulador; 36 recorridos de interfaz. Se añadieron 5 pruebas de lógica de presentación/formularios y 6 recorridos de pulido; no se eliminó cobertura anterior.
- Regresiones: permisos CEO/claims/revocación, privacidad de compensatorios, saldos/revisiones/CSV, resultados del calendario invariantes, vigencias/ICS, sesiones por UID, invitaciones, finanzas por moneda, planes, offline/recarga/reconexión y deduplicación.
- Matriz automatizada de seis secciones en claro/oscuro a 320, 390, 412, 768 y 1440 px; etiquetas y navegación activa, ancho de documento y último control accesible. Altura 390×420 y texto al 200 % a 320. No se probaron teclado físico, todas las combinaciones de zoom de SO, notch real ni Safari/iPhone físico.
- Bienvenida/FAQ: nuevo/existente, invitación pendiente, omitir/cerrar/reabrir, foco/teclado/movimiento reducido y destinos reales. Compartir: cancelación sin escritura, fallo de servidor conserva estado, quitar no revoca. PWA: actualización fallida y dos pestañas con worker local real; comprobador de red y ciclo de descarga/espera sin recargas forzadas.
- Primeros intentos: se adaptaron expectativas antiguas de texto/confirmación y un selector ambiguo; hubo un intento afectado por Fast Refresh mientras se editaba. Una integración posterior dio 154/154 y 35/36, revelando el falso aviso tras reconexión descrito arriba; se corrigió y pasó la repetición dirigida. No se presentan esos intentos como aprobados.
- Primera CI Linux del commit `d54a99d`: 154/154 y 33/36. Detectó 2 px de desborde en Roster a 320 px y dos fallos posteriores del fixture al reiniciar el worker y depender de una captura inicial aún no versionada. Se restringió la fila de bitácora y el encabezado del calendario; el fixture restaura su identidad desde su propio registro Auth local, sin depender de capturas ni saltarse controles. La aserción conserva el límite estricto del viewport y añade diagnóstico de elementos desbordados. La repetición final se registra aparte; no se marcó esta CI fallida como aprobada.
- Hubo además un intento local 35/36 con recarga del entorno Vite durante la espera de exportación privada (la traza confirma otro GET del documento, no un fallo de CSV) y otro 35/36 cuya nueva prueba navegaba cuando el envío seguía en curso. La protección bloqueó correctamente esa navegación; la prueba ahora espera el cierre real del formulario y confirmación. La repetición final sobre el árbol inmóvil aprobó los 36, sin reintentos ni exclusiones.
- Segunda CI, [40138819205](https://github.com/mejiasmaximiliano-cmd/RosterMax/actions/runs/40138819205), commit 53a2637: 154/154 y 34/36. Tamaños y restauración de fixtures ya aprobaron. Fallaron el recorrido offline inmediato y el contraste durante la transición de tema; se corrigieron ambos comportamientos en beta-0.9.1, no se relajaron umbrales ni se agregaron reintentos a CI. La ejecución final se registra por separado.
- Tercera CI, [40139925870](https://github.com/mejiasmaximiliano-cmd/RosterMax/actions/runs/40139925870), commit 81de26b: 154/154 y 33/36. Offline y contraste ya aprobaron. Tres recorridos encontraron «Guardado en curso»: dos navegaban tras ver el dato local pero antes de terminar su formulario; otro confundía una escritura de consentimiento con un formulario ocupado. Se acotó el estado ocupado al formulario que envía, con contador transitorio y liberación idempotente; las dos pruebas esperan el cierre real del formulario, no un retardo arbitrario. Nueva prueba de aislamiento entre formularios. No se oculta ni se marca aprobada esta ejecución fallida.
- Al retomar tras una interrupción, un arranque local comenzó antes de que Firestore estuviera escuchando: 136 aprobadas y 19 canceladas por ECONNREFUSED; no se cuenta como aprobado. Se comprobaron ambos servicios locales (HTTP 200) antes de la ejecución completa final de 155 + 36 aprobadas, sin reintentos de Playwright ni pruebas omitidas.
- Cuarta CI, [40155454178](https://github.com/mejiasmaximiliano-cmd/RosterMax/actions/runs/40155454178), commit 817ee50: 155/155 y 35/36. Un cierre de borrador no mostró advertencia. Se confirmó una carrera real: el marcado inicial diferido con requestAnimationFrame podía ejecutarse después de la primera edición y convertirla en la nueva referencia. Además, el descarte anterior reexaminaba todos los formularios en un cuadro futuro. Se corrigieron ambos momentos, y también el editor de planes que compartía el patrón. El experimento local reprodujo el fallo con ese comportamiento anterior (1 prueba fallida esperada, no aprobada) y aprobó el mismo recorrido con el cambio. La integración final y quinta CI se informan por separado.
- Quinta CI, [40156396586](https://github.com/mejiasmaximiliano-cmd/RosterMax/actions/runs/40156396586), fuente e8e8f86: 155/155 y 35/36. El cierre con cuadros demorados ya aprobó. El cambio de cuenta intentaba navegar cuando el botón había pasado de «Guardar plan» a «Guardando…»: esperar que desapareciera el primer nombre no probaba el cierre del editor. La traza confirma «Guardado en curso», no pérdida ni mezcla de cuentas. En bae43e9 las dos esperas afectadas observan la desaparición del campo del editor completo. Solo cambian pruebas, sin modificar la aplicación, timeouts, cobertura, umbrales ni reintentos. La suite local volvió a aprobar 155 + 36.
- Auditoría de dependencias productivas: `npm audit --omit=dev`, cero avisos. Sin cambio de dependencias; los seis avisos moderados de herramientas documentados en beta-0.8 no se presentan como solucionados ni motivaron un fix --force.
- Se conserva la separación diferida de módulos secundarios. Medición local de tres contextos fríos en [initial-load-local.json](audit/ux-polish/regression/initial-load-local.json), sin throttling/worker, no CWV productivas. Vite mantiene el aviso de chunk principal superior a 500 kB; no se declara una mejora de velocidad ni se emprende otra reestructuración.
- OAuth Google real, dos dispositivos físicos, entrega de alarmas en Calendar y actualización de PWA instalada en teléfono siguen siendo comprobaciones del propietario. No se implementó Push, audio, monetización ni telemetría nueva.

## Soporte y piloto

Implementado: feedback accesible con etiquetas, progreso, texto conservado y bloqueo de doble envío; canal, estados Nuevo/En atención/Resuelto y solicitud manual de eliminación existentes preservados. Guías preparadas para revisar/clasificar, verificar identidad cuando corresponda, atender y registrar resolución sin divulgar contenido privado.

Pendientes **operativos del propietario**, no funciones anunciadas como terminadas: responsable real y datos que correspondan; contacto de privacidad/soporte dedicado; política/retención; canal y procedimiento verificado de identidad/respuesta/eliminación; ubicación privada y retención de notas del piloto. No se publicó el correo personal del propietario ni se inventaron contactos, garantías o plazos. Solicitar eliminación registra un pedido: no borra automáticamente Auth ni sus datos asociados.

## Publicación y reversión

Procedimiento: lint y suite completa sobre el commit de implementación; build `node scripts/build-production.mjs --production`; fetch e integración en main sin force; push autorizado; verificar CI, estado Vercel, commit/build de manifiesto y API de red con nonce, worker y recursos. `config/production.public.json`, proyecto `rostermax-60242`, namespace `roster-max-production`, IDs y reglas se conservan. El build rechaza variables de Vercel contradictorias. **No requiere desplegar reglas sin cambios.**

Reversión acotada **sin quitar la corrección de persistencia local**: desde una rama correctiva basada en main actualizado, ejecutar `git restore --source=060833d0374e52a26481c36e547acb8acbb23808 -- src/App.jsx src/components src/index.css e2e`. Esto recupera la UI/recorridos beta-0.8 compatibles con compensatorios, revocación y vigencias, no datos. Conservar **src/lib/useCompensatories.js actual**, todos los demás motores/reglas/configuración productiva, scripts de build/API y mecanismo PWA; no revertir en bloque `81de26b`, porque retiraría la espera de confirmación local. Mantener el cambio de tema atómico (sin la transición global de color) y marcar una versión correctiva coherente en App/vite.config.js. Ejecutar lint, suite de la UI restaurada con emuladores, repetición offline y build explícito; registrar commit y push normal, comprobar nueva versión y recursos. No activar un despliegue antiguo que carezca de la corrección local, ni borrar IndexedDB, documentos, historiales o permisos. No se ejecutó esta reversión: queda preparada para un fallo crítico posterior.

### Comprobación pública final

Vercel: [despliegue correcto](https://vercel.com/mejiasmaximiliano-3306s-projects/roster-max/6RHt6YJKXeBNh2KdtJH5Beb1ZaCt), estado success. `/version.json` sirve beta-0.9.2, commit `e8e8f8612a785547701c9fb58658e2b859ead0c9`, build **`bc3424993a10da2ad40e`**, construido 25/10/2026 02:57:24 UTC. El build local indicado en la tabla es de Windows; el identificador servido corresponde a la compilación Vercel y es el usado para comprobar API/worker/recursos, no se confunden ambos artefactos.

[Comprobación pública](audit/ux-polish/production-check.json), repetida después de aprobar CI, 25/10 03:11:42 UTC: HTML 200, manifiesto/API con nonce coincidente, worker del mismo build y 11 recursos JS/CSS disponibles con sus huellas; cero errores de página o red pública inesperados. Caché de versión completa instalada. Lecturas sin autenticación a CEO y registro privado de compensatorios: 403.

La ejecución pública de navegador intercepta Auth **antes de crear un invitado** para no escribir en producción: su [pantalla de sesión bloqueada intencional](audit/ux-polish/production-readonly-session-gate-390.png) no prueba un fallo real ni un recorrido autenticado. El uso funcional se prueba con emuladores, no se disfraza como sesión productiva. No se usaron credenciales reales de usuarios para producir capturas ni se afirma OAuth físico comprobado.

[Lectura agregada real](audit/ux-polish/production-data-state.json), 25/10 03:11:48 UTC: reglas desplegadas sin cambios, ruleset `ce318a10-bd90-4082-965e-35605e9f385a`, SHA-256 normalizado `6ccbeacc7c57ad1ded8957e3e383caca08d808ec5ba9630e87a1152033ed5e03`, igual al repositorio. Cuatro comentarios, todos resueltos, los mismos conteos que antes de publicar; no se cambió ningún estado. No demuestra por sí solo cada documento privado: la conservación se apoya también en no modificar modelos ni efectuar migraciones/escrituras de prueba productivas.

CI de GitHub final: [ejecución 40156913134](https://github.com/mejiasmaximiliano-cmd/RosterMax/actions/runs/40156913134), commit de pruebas `bae43e95c2967f6834fc3bdae5aba4c3ec0f79a7`, **success**, completada 25/10/2026 03:10:26 UTC. Logs confirmados: **155/155** lógica/reglas, cero fallidas/canceladas/omitidas; **36/36** interfaz (3,8 min); lint, build de emulador y auditoría de dependencias productivas aprobados. [Resumen de CI](audit/ux-polish/ci-final.json) y [resumen local exacto](audit/ux-polish/local-validation.json). Las cinco CI fallidas anteriores se conservan como antecedentes, no como validación final. El commit de pruebas y el posterior de documentación no generan un frontend distinto: Vercel omite sus builds por el ignoreCommand existente y la URL pública conserva el fuente e8e8f86 comprobado.

## Actualizar sin perder datos y recorrido en el teléfono

1. Con conexión, abrir Ajustes y revisar el estado superior. Esperar «Sincronizado»; si dice pendiente/error, recuperar conexión y revisarlo antes de cerrar. No borrar caché, almacenamiento, IndexedDB ni desinstalar para actualizar.
2. En Actualización de la app, comprobar versión. «Comprobando» no significa descarga completa. Esperar «Actualización lista para activar»; cerrar todas las ventanas/pestañas de RosterMax de **ese navegador/dispositivo**, también la PWA, y reabrir. No se fuerza recarga durante escrituras. Si falla la descarga, conservar la versión utilizable y reintentar con conexión.
3. Confirmar beta-0.9.2 y la preferencia de tema conservada. En Roster, leer hoy/ciclo/próxima subida; elegir otra fecha y distinguir la consulta. Abrir compensatorios sin guardar movimientos reales de prueba.
4. Revisar Equipo: lista antes de incorporación; abrir Quitar solo para leer y cancelar, sin quitar a nadie ni revocar códigos reales. Revisar Finanzas: disponible estimado, gasto y edición de presupuesto desplegable.
5. Ajustes → Ayuda: reabrir historias, cerrar/omitir sin reconfigurar; abrir FAQ e ir/volver. En Compartir mi roster, leer el diálogo global y **Cancelar**; no desactivar el código del propietario para comprobarlo.
6. Con la cuenta propietaria, comprobar CEO y sus fuentes/cobertura/feedback, sin cambiar estados para probar. OAuth real debe comprobarlo el propietario. Para ensayar guardado offline, reconexión y cambios en temas, usar una cuenta de prueba con datos ficticios separada; no tocar finanzas/compañeros reales.
7. Después, usar [UX_PILOT.md](docs/UX_PILOT.md) con los compañeros elegidos y registrar solo tarea completada, ayuda y confusión, sin contenidos privados.
