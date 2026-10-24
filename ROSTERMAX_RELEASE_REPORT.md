# RosterMax beta-0.7 — entrega integral y publicación

Fecha: 24/10/2026. Horarios técnicos en UTC (Argentina = UTC−3).

## Resumen para el propietario

La versión está publicada en **https://rostermax.vercel.app/**. Se conservaron las cuentas, rutas de datos y el motor del calendario. El CEO explica qué está contando; Compensatorios mantiene dos saldos privados y exporta un historial verificable; Roster, Equipo, Franco, Finanzas y Ajustes son más fáciles de recorrer. No se reescribió la aplicación ni se añadieron servicios pagos.

El censo real actualizado contiene **4 cuentas guardadas con Google y 181 invitadas: 185 cuentas técnicas**, no 185 personas. La actividad medida sigue siendo una muestra voluntaria de **1 cuenta**. Los cuatro comentarios existentes siguen nuevos; no fueron eliminados ni marcados resueltos. El censo continúa **manual**, sin automatización nueva.

Queda una comprobación física breve con tu Google y tu teléfono; la publicación no equivale a haber certificado OAuth real, todos los dispositivos o alarmas con la app cerrada. Al final está el recorrido sugerido.

## Versión, integración y producción comprobada

- Commit servido: **`ba44304ba29c0d14efc8c91487fd09637a0b73a9`**. Etiqueta remota: **`rostermax-beta-0.7`**.
- Versión: **beta-0.7**. Build público: **`f5b6a567ef6bf7e4519b`**. Compilado en Vercel el **24/10/2026 12:53:58.439 UTC**; comprobación pública **12:55:07 UTC**.
- [Despliegue Vercel confirmado](https://vercel.com/mejiasmaximiliano-3306s-projects/roster-max/3jbQrf2kCgxyhquSNUpmxCmSjV7M). [Manifiesto de versión servido](https://rostermax.vercel.app/version.json).
- Rama de implementación: `codex/integral-reliability-ceo-compensatorios`; integrada por **fast-forward** a `main`, con fetch previo y push normal. No había commits posteriores remotos para conciliar; no se utilizó force-push.
- Se conservaron los commits locales previos `25a8fab` y `44975c7`; esta entrega agregó `b23fb83` y la corrección final `ba44304`. No se descartó la auditoría preexistente sin seguimiento (`ROSTERMAX_AUDIT_REPORT.md`, `audit/2026-10-24/`).
- La actualización posterior de este reporte es documental: `ignoreCommand` omite desplegar cambios exclusivos de documentación/evidencias. El commit servido se identifica por el manifiesto, no por asumir que cualquier HEAD documental se desplegó.

## CEO: conciliación y límites de las cifras

| Evidencia | Entorno y fecha | Cifras / significado |
| --- | --- | --- |
| Censo almacenado observado en la auditoría | Producción, snapshot generado 26/09/2026 04:17 UTC | 150 técnicas = 146 invitadas + 4 guardadas |
| Enumeración administrativa posterior | Producción, 24/10/2026; nueva lectura 12:30 UTC | 185 técnicas = 181 invitadas + 4 Google; 0 deshabilitadas |
| Capturas nuevas de pruebas con 150/146/4 | **Emuladores locales**, fixtures de `e2e/ceo-audience.spec.js` | Datos ficticios; no validan producción ni demuestran una caída de usuarios |
| Censo guardado al iniciar la preparación final | Producción, generado 24/10/2026 11:42:22.951 UTC | Ya coincidía con 185/181/4; no se atribuye esa actualización previa a esta ejecución |
| Actualización manual efectuada en esta entrega | Producción, confirmada 24/10/2026 **12:47:43.752 UTC** | 185/181/4, con nuevos desgloses de altas; solo reemplaza `admin_stats/accounts` |
| Actividad voluntaria real | Producción, lectura 12:55:48 UTC | 1 cuenta medida, 1 activa medida en 24 h / 7 / 30 días; 1 instalación detectada en esa muestra |

La diferencia de 35 entre el censo antiguo y el actual corresponde a **cuentas invitadas**; las cuatro Google permanecen. No hay evidencia de pérdida de esas cuentas. Un invitado puede corresponder a un dispositivo, navegación privada o pruebas de la misma persona; no es una descarga ni una persona identificada. Los 57 documentos públicos de roster tampoco son 57 personas. Cero documentos de métricas de campaña no demuestra ausencia de vistas sin consentimiento.

La lectura real más reciente de Auth muestra 2 altas en 24 h, 8 en 7 días y 44 en 30 días. Último login de Auth: 3/9/45 cuentas en esas ventanas, **no** aperturas ni actividad medida. Las consultas auxiliares collection-group sobre settings siguen devolviendo HTTP 400: se documentan como **no disponibles**, no como cero.

El panel prioriza cuentas guardadas y actividad, luego operaciones/feedback; crear campaña queda desplegable. Cada métrica mantiene definición, fuente, período, fecha y cobertura. Carga, ausencia, cero confirmado, error y datos conservados/desactualizados no se equiparan. Propietario/pruebas se incluyen salvo filtros visibles y explícitos de actividad/funciones; no se descartan identidades por correo o nombre.

Las operaciones instrumentadas requieren consentimiento y confirmación del servidor, con recibos/IDs estables para reintentos. No contienen montos, notas, nombres de planes, motivos de licencia ni contenido compensatorio. No se reconstruyen eventos históricos. La medición nueva quedó disponible con beta-0.7, verificada públicamente desde 12:47 UTC del 24/10; el panel muestra el primer evento realmente conservado, que puede ser posterior. El refresco CLI del censo es manual y **no genera** el evento administrativo de la interfaz; queda registrado en esta evidencia, no se anuncia una automatización inexistente.

Acceso: registro protegido activo de **1 identidad**, revisión completa de 185 cuentas con **0 claims admin**. Se conserva la vía de claims firmados compatible; un registro inactivo prevalece sobre un claim antiguo. No se añadieron administradores ni permisos privados. [Agregados reales y reglas verificadas](audit/release/ceo-production-aggregates.json).

## Cambios funcionales entregados

### Roster, Franco y Equipo

El calendario vuelve a ser lo primero. El detalle de hoy no se repite en otra tarjeta grande: el resumen compacto de hoy aparece al consultar otra fecha. “Planificar” usa el día elegido. Los cambios temporales vigentes/próximos se distinguen de los anteriores, conservados en un historial accesible con sus controles.

Franco distingue período completo y días restantes, indicando expresamente si incluye hoy. Permite crear el primer plan sin cargar antes otras cosas. No se modificó el contrato del cálculo usado por presupuesto/coincidencias: el nuevo descriptor es de presentación.

**Caso representativo sintético obligatorio:** diagrama 14×14, subida conocida 01/10/2026 → 24/10 = franco **10 de 14**; franco completo **15–28/10**, **5 días restantes incluido el 24**; próxima subida **29/10**. Un cambio permanente desde 01/11 mantiene los 732 resultados anteriores comparados; registrar compensatorios conserva los 1.096 resultados de calendario del ensayo. No se reconfiguró la cuenta del propietario para demostrarlo.

“Mi equipo” aparece antes de “Añadir compañero”, que se despliega. Carga manual y vinculación tienen explicaciones separadas. La fecha de publicación se muestra solo si hay timestamp; una copia local se identifica como no comprobada recientemente. Descanso ya no se recorta. Quitar de la lista no se presenta como revocar acceso; la desactivación/rotación del código mantiene su alcance para todos y no borra copias ya vistas.

Se preservaron transporte **estimado**, confirmación con la empresa y alcance real de los avisos. Una licencia no se ofrece como franco; sus motivos permanecen privados. Las vigencias conservan resultados anteriores y formato compartido compatible, sin conexión con compensatorios.

### Finanzas y Ajustes

Resumen y registro de gastos quedan por delante de la edición desplegable del presupuesto. Disponible se identifica como **estimación basada en datos cargados**, no saldo bancario; se avisa cuando no hay gastos del mes/moneda. Se verificaron montos grandes sin partir cifras ni desbordar. Pesos/dólares, presupuesto y aportes reales a metas permanecen separados, sin conversiones ni cambio de fórmula.

Ajustes agrupa cuenta/sincronización, perfil, diagrama, avisos, privacidad/datos y apariencia; conserva exportación y consentimiento. La eliminación de cuenta sigue siendo una **solicitud con atención manual**, no un borrado automático. No se inventaron identidad, contacto o plazos del responsable.

### Compensatorios privados

Tarjeta desde Roster, dos saldos que no se netean: **empresa debe 3 → disfruto 1 → quedan 2**; **trabajador debe 2 → compensa 0,5 → quedan 1,5**. Unidades enteras de medio día, sin conversión desde horas. Compensaciones enlazadas, correcciones/anulaciones por nueva revisión e historial inmutable. No se descuenta más de lo pendiente.

Registros resumidos y detalles desplegables; filtros de pendientes, saldados, anulados o todos. Fechas informativas en formato local, sin convertirlas desde medianoche UTC al día anterior. Estados: guardado en el dispositivo, pendiente, sincronizado o error/revisión. La cola y los IDs estables sobreviven a recarga y evitan duplicados por doble clic/reintentos; el indicador global también contempla este módulo.

CSV: ambos saldos y **todo** el historial, sin aplicar el filtro visual. Las filas DEUDA aportan el pendiente computable una sola vez; anuladas aportan cero. SALDO es resumen y MOVIMIENTO es trazabilidad, no filas para volver a sumar. Exportación bloqueada hasta disponer de todas las revisiones conocidas; un registro local se identifica como tal. Se probaron decimales, separador regional, comillas, saltos de línea y protección de fórmulas de hoja de cálculo en textos introducidos por el usuario.

Las pruebas comparan saldos CSV/interfaz y todos los resultados de calendarios antes/después: **ninguna** operación compensatoria modifica roster, coincidencias, presupuesto, avisos ni ICS. Compañeros y CEO tienen denegado el contenido privado.

## PWA, rendimiento y resiliencia

CEO, Finanzas, Franco y Privacidad se cargan por separado. El worker precarga **todos** los chunks necesarios antes de aceptar el nuevo HTML: si falla incluso un módulo secundario, conserva la versión completa activa. Dos pestañas y recarga offline se comprobaron. Si un módulo falla al abrir una sección, se muestra recuperación y la navegación principal sigue disponible; no hay recarga automática ni borrado de caché/IndexedDB.

El aviso de versión disponible respeta el mecanismo existente: cerrar todas las ventanas para activarla, luego reabrir. Advierte sobre escrituras pendientes, incluidos compensatorios. No se usa skipWaiting.

Comparación local con configuración production explícita y mismo equipo/toolchain: baseline seguro `44975c7` = **1.110.653 bytes JS iniciales**; entrega final = **1.049.748**, contando entrada y sus dos imports estáticos (**−5,48%**). Gzip medido con Node/zlib en ambos: 325.110 → 309.259 bytes (**−4,88%**). El precache completo no se redujo proporcionalmente: los módulos diferidos se descargan en segundo plano para mantener offline. El JavaScript inicial realmente leído del despliegue Vercel suma 1.051.073 bytes (entrada + imports estáticos); la comparación anterior es entre builds locales equivalentes, no entre plataformas. Persiste el aviso de chunk principal >500 kB y el peso del SDK Firebase; no se promete una aceleración percibida ni se oculta la limitación.

Tres cargas frías locales a 390 px, loopback sin throttling ni SW: DOMContentLoaded **148,6 / 150,1 / 145,1 ms**; sin descargar CEO/Finanzas/Franco en la carga inicial. Son ensayos de laboratorio, no tiempos móviles ni Core Web Vitals productivos. [Medición reproducible](audit/release/initial-load-local.json).

## Validación: qué pasó y qué no se probó

| Control sobre la implementación final | Resultado |
| --- | --- |
| Lint | Aprobado, sin errores |
| Unidades + reglas con emuladores | **142 aprobadas**, 0 fallidas/omitidas/canceladas; 123 de lógica y 19 casos de reglas |
| Interfaz Chrome local | **21 recorridos aprobados**, 0 fallidos/omitidos; 390/768/1440 px, claro/oscuro, altura reducida, sesiones, invitación recíproca, finanzas, calendario, privacidad, offline, CSV, recuperación de sección y PWA |
| Build emulator y production explícito | Aprobados; aviso de tamaño indicado arriba |
| Build genérico sin entorno | Rechazo esperado antes de Firebase: prueba negativa aprobada; no es un deploy fallido |
| Reglas desplegadas | Compilación Firebase aprobada; huella desplegada igual a la local |
| Público real | HTML/manifiesto/worker y 10 recursos HTTP 200; commit exacto confirmado; ejecución del worker/cache completa; 0 errores de ejecución/red pública inesperados |
| Lectura pública sin sesión | CEO y compensatorios: **HTTP 403**, como corresponde |
| npm audit --omit=dev | **0 vulnerabilidades** |
| npm audit completo | **6 moderadas de herramientas Node**, 0 altas/críticas; no se declara limpio. Sin fix --force ni degradaciones |
| git diff --check | Aprobado; advertencias LF/CRLF de Windows, no fallos de whitespace |
| CI GitHub Actions del commit final | **Aprobado**, ejecución [40095830054](https://github.com/mejiasmaximiliano-cmd/RosterMax/actions/runs/40095830054), completada 12:57:32 UTC; Node 24 / Java 21 / Chromium en Linux, suite con emuladores y artefactos |

Casos de seguridad: propietario/usuario normal, registro protegido/custom claims/revocación, lectura privada denegada incluso al CEO, esquema cerrado, revisión obsoleta, sobrecompensación, conservación de eventos, compartición retirada y consentimiento. No se sustituyen por un simple chequeo de correo frontend.

Las desconexiones intencionales producen avisos de transporte del SDK; se comprueba recuperación y ausencia de duplicados, no se los cuenta como errores inesperados de producción. El primer ensayo nuevo de CSV detectó una expectativa incorrecta del test respecto del recorte de espacios de notas; se corrigió la expectativa y se verificó aparte el escape de espacios iniciales. La suite final pasó completa.

La prueba pública usa **recursos reales de producción**, pero intercepta Auth **antes** de crear un invitado y bloquea escrituras de backend. Por eso su captura muestra un error de sesión deliberado: **no es una caída de producción**. No valida navegación con sesión real, OAuth, consentimientos del sistema o un teléfono físico. [Resultados públicos exactos](audit/release/production-check.json). La revisión adicional de [consola](audit/release/production-console-readonly.json) registra únicamente el HTTP 400 de Auth deliberadamente interceptado y el registro correcto del worker; no hubo errores JavaScript no controlados. La herramienta de navegación de escritorio no pudo iniciar su kernel; se usó el chequeo automatizado de solo lectura y se conservó esta limitación.

## Configuración, reglas y reversión

No se necesitó crear preview. La configuración web **pública** existente queda explícita/versionada en `config/production.public.json`; no contiene credenciales administrativas. El comando productivo solo acepta el destino Production de Vercel o el flag local `--production`; valores contradictorios detienen el build. Los nueve valores públicos se verificaron presentes en el bundle servido, sin transcribir la clave cliente en este reporte. Es configuración web pública, no una cuenta de servicio ni autorización administrativa ([documentación Firebase](https://firebase.google.com/docs/projects/api-keys)). No se accedió al panel privado de variables Vercel: la verificación es del comando/configuración versionada y del resultado compilado realmente servido. El build local genérico y las previews no heredan producción silenciosamente.

Se mantuvieron `rostermax-60242`, `roster-max-production` y el origen canonical. Ninguna migración ni fixture en cuentas reales. `compensatory_debts`, `compensatory_entries`, recibos, eventos mínimos y vigencias mantienen el esquema de la fase anterior; CSV y filtros son presentación/exportación, no un nuevo saldo persistido. Feedback solo se consulta, no se migra.

Reglas publicadas **12:45:04.918 UTC**: ruleset `ce318a10-bd90-4082-965e-35605e9f385a`; SHA-256 normalizado **`6ccbeacc7c57ad1ded8957e3e383caca08d808ec5ba9630e87a1152033ed5e03`**. Verificadas de nuevo tras publicar frontend. Se preservan las protecciones aunque se revierta UI.

Reversión concreta y ensayada como build: baseline `44975c7` compiló con configuración productiva explícita. Crear rama correctiva desde main; restaurar **solo** src/public/index.html/vite.config.js/e2e/tests desde ese commit, conservar reglas nuevas, configuración productiva y su script de build; ejecutar suite anterior y build, commit y push normal a main. No restaurar reglas antiguas ni volver a `8db6d54`, que ignora vigencias. No borrar datos ni compensaciones ni aplanar períodos. Pasos completos: [runbook vigente](docs/INTEGRAL_RUNBOOK.md).

## Evidencias y pendientes concretos

27 capturas locales de la implementación, con datos ficticios y procedencia en [README de evidencias](audit/release/README.md). Ejemplos: [Roster móvil](audit/release/roster-390.png), [Franco](audit/release/franco-390.png), [Equipo tablet](audit/release/equipo-768.png), [Finanzas claro](audit/release/finanzas-light-390.png), [CEO escritorio](audit/release/ceo-1440.png), [Compensatorios](audit/release/compensatorios-390.png), [diálogo con espacio reducido](audit/release/dialogo-teclado-dark-390.png), [navegación real del viewport](audit/release/navegacion-dark-390.png).

En capturas completas los encabezados sticky pueden aparecer a mitad de imagen por el scroll/ensamblado. Se contrastaron con capturas de viewport y límites de botones; no se presenta ese artefacto como navegación rota. No se afirma haber probado el teclado nativo por reducir la altura del navegador.

Pendientes: prueba Google/PWA física y notificaciones del sistema; identidad/contacto/política de conservación y procedimiento manual de eliminación del responsable; decidir licencia comercial del clima antes de vender anuncios. La API gratuita de Open-Meteo no debe darse por autorizada para una app monetizada con publicidad ([condiciones](https://open-meteo.com/en/terms)). No se contrató nada. Los seis avisos de desarrollo y el tamaño de Firebase se documentan, no se resolvieron mediante cambios incompatibles. Las alertas siguen siendo al abrir; ICS/Google Calendar dependen del calendario del teléfono; **no se implementó Push con la app cerrada**.

## Actualizar la PWA y probar en tu teléfono

1. Con conexión, espera confirmación de sincronización en Roster y Compensatorios. No cierres si hay intentos en error sin revisar. **No borres caché, almacenamiento ni desinstales.**
2. En Ajustes pulsa “Comprobar actualización”. Cierra **todas** las pestañas/ventanas y la app RosterMax en ese navegador/dispositivo; vuelve a abrir. Si otra ventana del mismo navegador sigue abierta, el worker anterior puede continuar esperando; un dispositivo distinto no lo bloquea. Comprueba beta-0.7 y `ba44304` en versión/actualizaciones. Si vuelve la anterior, repite cerrar todas después de descargar, sin borrar datos.
3. Google: si ya tenías cuenta, usa **Ya tengo cuenta**; si es la primera vinculación de ese invitado, **Guardar con Google**. Comprueba que reaparecen tus datos; no crees otra configuración para forzarlo.
4. CEO: solo tu cuenta debe verlo. Debe mostrar 4 guardadas/Google y 181 invitadas al censo indicado, junto a fecha y cobertura voluntaria. “Actualizar censo con Google” sigue siendo manual; **esta entrega ya lo actualizó**, no requiere otra autorización para que aparezca el dato guardado.
5. Compensatorios: consulta saldos y exporta CSV sin modificar nada. Si quieres probar escrituras, usa únicamente movimientos personales reales; el ejemplo 3→2 y 2→1,5 ya está validado con cuentas ficticias, no es necesario cargarlo en tu cuenta.
6. Calendario/Franco: revisa un día conocido y otro seleccionado; confirma día del ciclo, período completo/restante y próxima subida. Planificar debe llevar la fecha elegida. No alteres el diagrama para hacer coincidir el ejemplo sintético.
7. Equipo: consulta vinculados/carga manual, abre Añadir compañero y comprueba Descanso. Quitar una persona no revoca tu código; ese control está separado en Ajustes.
8. Offline: abre primero con conexión, consulta sin red y vuelve a conectarte. Si registras un cambio real, debe verse local/pendiente y después sincronizado, una sola vez tras recargar. Si hay error, conserva la app/datos y revisa el intento; no lo recrees a ciegas.
