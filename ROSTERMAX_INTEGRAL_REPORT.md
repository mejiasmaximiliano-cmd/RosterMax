# RosterMax — informe de misión integral

> Informe histórico de la fase local anterior. La autorización posterior de publicación y la entrega final se documentan en **ROSTERMAX_RELEASE_REPORT.md**. Las afirmaciones de “no publicado” de este documento corresponden exclusivamente a aquella fase.

Fecha: 24/10/2026. Repositorio: mejiasmaximiliano-cmd/RosterMax.

## Resumen para el propietario

La implementación está preparada **en local, no en producción**. Conserva el calendario, las cuentas y las rutas de datos existentes; no reescribe la app. Se agregaron compensatorios privados, vigencias de diagramas, revocación efectiva de compartición, indicadores offline durables y un CEO con fuentes y cobertura explícitas.

El problema del CEO tiene una explicación comprobada: el censo guardado era antiguo y la actividad era una muestra voluntaria, no todas las cuentas. Hay **4 cuentas vinculadas con Google**, coherente con el propietario y tres colegas; eso no demuestra cuántas personas usan diariamente la app. El censo técnico actual contiene **185 cuentas**, de las que **181 son invitadas**. No se deben vender esas 185 como personas, instalaciones ni usuarios activos.

Validación de integración: **140 pruebas de lógica/reglas y 19 recorridos de interfaz aprobados**. Incluye pantallas de 390, 768 y 1440 píxeles y recarga PWA realmente offline. No certifica funcionamiento universal ni reemplaza pruebas físicas.

No se hizo push, merge, deploy, modificación de permisos ni escritura en Vercel/Firebase de producción. Las lecturas administrativas fueron agregadas y no se conservaron correos, nombres, UIDs reales ni contenido personal.

## 1. Procedencia y estado de trabajo

- Base inspeccionada: main, commit `8db6d54eee2c934c651e42e1e7a0233abe3a4875`.
- Rama dedicada: `codex/integral-reliability-ceo-compensatorios`.
- Implementación guardada en commit local `25a8fabb6f540bce3eb64a172a0543156c101d5a`; informe, evidencias y ajuste final de whitespace se entregan en un commit separado. Ninguno se subió a GitHub.
- Al comenzar había una auditoría y evidencias sin seguimiento: `ROSTERMAX_AUDIT_REPORT.md` y `audit/`. Se conservaron; las evidencias nuevas están únicamente en `audit/integral/`.
- No se encontraron instrucciones AGENTS.md aplicables en el repositorio/ancestros. Se leyeron README, la auditoría y documentos relevantes existentes.
- Stack instalado verificado: React 19.3.1, Firebase JS 12.19.0, Vite 8.3.5, Tailwind, Playwright 1.64.1; Node 24.14.0, Java 21 y Chrome local para pruebas.
- Se reutilizó la evidencia de producción de la auditoría; esta misión no hizo otra auditoría completa ni comprobó un nuevo commit desplegado. El commit exacto asociado al alias Vercel sigue sin verificación administrativa concluyente; no confundir el código local nuevo con lo que sirve hoy el sitio.

## 2. Etapas completadas y pendientes

| Etapa | Estado local comprobado | Pendiente fuera de esta implementación |
| --- | --- | --- |
| Entornos y dependencias | Configuración explícita, rechazo previo a Firebase, destinos coherentes; dependencias compatibles actualizadas | Configurar variables reales de Production/Preview y autorizar publicación |
| CEO | Diagnóstico conciliado, acceso protegido coherente, estados de datos, desgloses, instrumentación voluntaria, feedback y acciones administrativas | OAuth administrativo real en el dispositivo del propietario; el censo continúa manual |
| Compensatorios | Registro independiente, medios días, dos saldos, compensaciones parciales, correcciones/anulaciones y privacidad | Prueba física prolongada; publicar reglas y frontend con autorización posterior |
| Offline/PWA/compartición | Pendientes tras recarga, actualización atómica, dos pestañas, retirada y rotación verificadas | Android/iOS físicos, almacenamiento bajo presión y condiciones de red reales prolongadas |
| Vigencias | Cambio permanente desde fecha, corrección explícita, historial y formato compartido compatible | Probar con colegas actualizados al publicar; clientes antiguos no entienden el pasado por vigencias |
| Experiencia/mantenimiento | Estados iniciales, licencias, foco/etiquetas, ancho de escritorio, módulos extraídos, exportación y borrado de medición propia | Identidad/contacto/conservación y política definitivos; eliminación de cuenta sigue siendo atención manual |
| Calidad/publicación | Suite local, controles versionados, capturas y runbook | CI remoto no ejecutado; no se publicó nada |

## 3. CEO: causa y conciliación real

Lectura administrativa de Auth a las 04:09 UTC; comprobación del snapshot/privilegios a las 11:16 UTC del 24/10/2026. Evidencia mínima: [ceo-readonly-summary.json](audit/integral/ceo-readonly-summary.json).

| Fuente | Resultado | Interpretación correcta |
| --- | --- | --- |
| Censo guardado, generado el 26/09/2026 | 150 técnicas = 4 vinculadas + 146 invitadas | Foto antigua, no contador en vivo |
| Firebase Authentication, enumeración completa actual | 185 técnicas = 4 registradas Google + 181 invitadas; 0 deshabilitadas | El aumento de 35 corresponde a invitadas, no a nuevas cuentas Google |
| Altas de Auth, todos los tipos | 8 en 7 días; 44 en 30 días | Cuentas creadas, no personas ni aperturas |
| Último login de Auth | 2 en 24h; 8 en 7d; 44 en 30d | Cuentas con autenticación en la ventana, no cantidad de logins ni uso diario |
| Actividad voluntaria | 1 cuenta; activa medida en 24h/7d/30d: 1 | El resto puede usar la app sin participar en medición |
| Instalación detectada en esa muestra | 1 cuenta | No son descargas totales, dispositivos únicos ni desinstalaciones |
| Documentos públicos de roster | 57 | Documentos compartidos, no personas; pueden conservar versiones/códigos antiguos |
| Documentos de métricas de campaña | 0 | No hay interacciones conservadas medidas; no prueba ausencia de vistas sin consentimiento |

Las consultas auxiliares collection-group sobre settings devolvieron HTTP 400. Se marcaron no disponibles; no se transformaron en ceros ni se usaron para inventar cifras. No se publicó el censo actualizado durante la misión.

No apareció evidencia de que falten las cuatro cuentas Google por permisos: el registro protegido contiene **una identidad activa**, y la revisión agregada de las **185 cuentas** no encontró custom claims admin. La cuenta del registro tampoco tiene ese claim. El acceso real observado depende del registro, no del correo frontend.

### Privilegios y revocación

`adminAccess.js`, `useCeoData.js` y `firestore.rules` son coherentes: un registro existente con active=false prevalece sobre un claim admin antiguo; si no existe registro, sigue funcionando el claim firmado compatible ya previsto. Un usuario no puede crear ni cambiar su registro administrativo. No se agregaron administradores ni se ampliaron sus permisos privados.

Para revocar una identidad con ambas vías, conservar el registro inactivo mientras se retira el claim y se revocan sus tokens mediante herramienta autorizada. Eliminar el registro manteniendo un claim activo reabriría deliberadamente la vía alternativa. Esta misión probó ambas vías y la revocación en emuladores; no modificó roles reales.

### Panel implementado

- Cuentas guardadas, Google, invitadas, deshabilitadas y total técnico; las deshabilitadas son un subconjunto y no se suman otra vez.
- Altas de 24h/7d/30d con desglose guardadas/invitadas cuando el censo nuevo lo contiene. La clasificación es el proveedor **actual**, no un histórico de vinculación. Un snapshot antiguo sin desglose muestra ausencia, no cero.
- Actividad móvil de 24h/7d/30d a partir de lastActiveAt; no genera tendencias históricas ni cuenta aperturas inexistentes. La medición visible actualiza aproximadamente cada 15 minutos.
- Uso voluntario de configuración de roster, aceptación de invitación, guardado/edición de planes, gastos, metas y compensatorios. Son operaciones confirmadas, no el contenido ni el número actual de objetos privados.
- Feedback con estados nuevo/en atención/resuelto; acciones de censo/campañas/atención registradas con metadatos mínimos. El registro no pretende auditar acciones realizadas fuera de la app en la consola Firebase; la vista muestra las últimas 30 acciones conservadas.
- Campañas: alcance de cuentas medidas, vistas, clics y CTR acumulados, con fuente, cobertura y fecha de lectura. No mide conversiones ni ventas.

Los paneles distinguen carga, falta de datos, cero confirmado, error y dato conservado/desactualizado. Una actualización fallida conserva el último resultado válido; el censo de otro proyecto se rechaza sin reemplazarlo. La actualización del censo continúa **manual**, con Google e IAM administrativo, no automática.

Las exclusiones del propietario y UID de pruebas son explícitas y visibles para actividad/funciones. El censo agregado y las campañas indican que incluyen propietario y pruebas; no tienen exclusiones ocultas ni se deducen identidades desde nombres o correos.

## 4. Compensatorios personales

Entrada: tarjeta en Roster → Ver historial y registrar. No agrega otra pestaña a la navegación principal y funciona aun sin diagrama configurado.

Dos saldos que jamás se netean automáticamente:

- La empresa me debe: 3 días → disfruto 1 → **quedan 2**.
- Yo debo a la empresa: 2 días → compenso 0,5 → **quedan 1,5**.

Se almacenan enteros de medio día: 3 días son 6 unidades; 0,5 día es 1 unidad. No hay conversión de horas según una jornada supuesta ni redondeos monetarios. Las cantidades válidas van de 0,5 a 10.000 días por registro.

Cada deuda tiene dirección, cantidad, fecha informativa y observación opcional. Cada compensación está enlazada a su deuda. No se puede descontar más de lo pendiente ni cambiar de dirección para cruzar saldos. Corregir y anular crea una nueva revisión; no reemplaza el evento original. Para anular una deuda parcialmente compensada se anulan primero sus compensaciones activas. Se admiten hasta 200 asignaciones activas por deuda, con mensaje explícito al alcanzar ese límite.

### Modelo y protección

Rutas privadas bajo users/UID:

- compensatory_debts/ID: cabecera con totalUnits, settledUnits, mapa de asignaciones, revisión y último evento.
- compensatory_entries/ID: apertura, corrección, compensación o anulación inmutable, con referencia a lo que corrige/anula.

Cabecera y evento se confirman en un lote atómico. Las reglas comprueban propietario, campos cerrados, cantidades enteras, invariantes del saldo, revisión consecutiva, timestamps de servidor y referencias. El cliente valida fechas reales; las reglas validan el formato de fecha y estructura. Compañeros y CEO no pueden leer el contenido. La regla privada genérica se excluyó únicamente para estas dos colecciones, de modo que no anule su validación específica.

La cola local guarda el intento con ID estable antes de escribir. La caché persistente y metadatos del SDK muestran qué está pendiente. Al recargar no se crea otro movimiento; reintentar conserva el identificador y comprueba si ya existe. Los conflictos de revisión requieren revisión/reintento, no sobrescritura silenciosa. Se corrigió una carrera detectada al abrir un formulario nuevo mientras terminaba el anterior; los controles se bloquean durante esa confirmación.

### Independencia demostrada

No se crean movimientos desde horas extra, licencias o cambios temporales. El módulo no modifica diagrama, excepciones, coincidencias, presupuesto, recordatorios ni exportaciones.

La prueba de contrato compara **todos los resultados de 732 fechas**, 24 calendarios mensuales, transición, recordatorio, excepciones públicas, coincidencias, presupuesto e ICS antes/después de varias operaciones, correcciones y anulaciones. Son idénticos. Los recorridos de las tres resoluciones repiten la igualdad de 732 fechas después del ejemplo obligatorio y de recargar.

## 5. Entornos, datos y compatibilidad

`environment.js` valida modo explícito emulator/preview/production, configuración completa y coherente, namespace y origen antes de inicializar Auth/Firestore o crear un invitado. Vite valida también al construir. No hay respaldo silencioso a producción ni selección solo por import.meta.env.PROD. VERCEL_ENV=preview rechaza configuración production y viceversa. Un hostname inesperado se rechaza antes del SDK.

Emuladores: proyecto ficticio demo-rostermax, Auth 9096, Firestore 8086, loopback. Preview necesita otro proyecto/namespace y su URL; la preview incompleta falla. Producción conserva identificadores y rutas actuales. Invitaciones utilizan el origen configurado y el censo recibe el proyecto explícito; las consultas administrativas a demo se bloquean antes de contactar Google.

Cambios de esquema compatibles:

| Datos | Cambio | Transición |
| --- | --- | --- |
| settings/roster | periods con vigencias opcionales | El objeto anterior sigue siendo la base de fechas anteriores |
| sync_codes | history de disponibilidad, sin notas, opcional | Se aceptan v1 y v2; campos superiores muestran el ciclo vigente para clientes antiguos |
| settings/sync | enabled opcional y rotación de code | Ausencia del campo conserva compatibilidad de los códigos antiguos |
| admin_stats/accounts | Desgloses de altas opcionales; proyecto debe coincidir con audiencia del token | Los snapshots antiguos siguen legibles; campos ausentes no equivalen a cero |
| feature_events | Tipo, propietario seudónimo, fecha de operación y de registro | Nuevo; sin histórico reconstruido y con consentimiento |
| operation_receipts | Recibo privado mínimo de una operación | Permite publicar metadatos solo después de confirmar la escritura privada |
| admin_audit | Actor técnico, acción, objeto y fecha | Nuevo; sin notas, finanzas o contenido de compensatorios |

La nueva medición **todavía no tiene fecha de inicio en producción**: comienza con la publicación autorizada, consentimiento y primera operación. La pantalla muestra la fecha del primer evento conservado, no un inicio histórico garantizado si se borraron registros. La escritura privada no depende de que funcione la medición. Los reintentos de metadatos usan el mismo ID y no se convierten en eventos nuevos.

### Vigencias

Cambiar permanentemente desde una fecha agrega una vigencia; corregir modifica deliberadamente la configuración que rige en la fecha elegida. El formulario advierte que una corrección afecta ese período y su pasado. La guía inicial reabierta tampoco aplana el historial existente.

Se conservan hasta 20 vigencias, sin truncar el historial silenciosamente. Las excepciones siguen aplicándose después de elegir la configuración del día y pueden cruzar vigencias. Las pruebas cubren 7×7, 14×14, 14×7, personalizados, fechas pasadas/futuras, año/bisiesto, wire compartido, coincidencias y exportaciones. Un cliente antiguo puede mostrar disponibilidad actual, pero no interpretar todo el pasado por vigencias: actualizar a los participantes es un requisito de transición.

## 6. Offline, PWA, experiencia y privacidad

- Se aprovechan metadatos de los listeners privados existentes; ya no depende solo de un contador en memoria. Guardado local, pendiente y confirmado tienen mensajes distintos, también tras recarga.
- La PWA usa caché por contenido del build, incluido shell, recursos públicos y worker. Solo acepta HTML después de descargar todos sus JS/CSS de entrada. Una instalación fallida no elimina la versión activa completa. No usa skipWaiting: las pestañas anteriores terminan juntas, sin forzar una recarga durante una escritura. Conserva además la versión completa anterior.
- Retirar compartición desactiva la publicación y elimina el código actual; las reglas rechazan lecturas/publicación si el propietario deshabilitó o rotó el código, incluso si queda un documento antiguo. Reactivar genera otro código. Quitar un compañero se describe correctamente como limpiar la lista, no retirar acceso.
- La revocación no borra lo ya visto, guardado offline, copiado o exportado por otro dispositivo. No se presenta como control selectivo por compañero: para retirar el código conocido se invalida para todos y se deben reenviar enlaces nuevos.
- Sin diagrama ya no aparecen 0/0 ni el falso mensaje de 366 días sin franco. Las cuentas nuevas no asumen ciudad, rubro o transporte; los datos existentes explícitos se conservan. El clima requiere elegir ubicación.
- Una ausencia/licencia no se anuncia como franco en la transición y el aviso. Los motivos permanecen privados. La deduplicación y tag de avisos incluyen UID.
- Diálogos de compensatorios/cuenta existente usan dialog nativo; la guía captura foco/Tab/Escape y lo devuelve. Se añadieron etiquetas, foco visible y texto mínimo más legible. El ancho máximo pasa de móvil a escritorio; las grillas existentes de finanzas/CEO aprovechan espacio sin desborde móvil.
- Privacidad: exportación de colecciones privadas conocidas desde servidor, con advertencia de sensibilidad; desactivación y borrado de medición propia en páginas de 200 registros; solicitud de eliminación en feedback con atención manual. El borrado de cuenta **no es autoservicio automático** y desinstalar/cerrar sesión tampoco borra la cuenta.
- No se inventó responsable, contacto ni plazos. Esos datos, el procedimiento operativo de atención y política definitiva siguen pendientes del propietario; no se promete cumplimiento legal.

## 7. Mantenimiento, rendimiento y dependencias

Se extrajeron validación de entornos, datos CEO, autorización, historial, motor/hook/interfaz de compensatorios, medición, privacidad y modal. No se reescribió el motor del calendario ni se fragmentaron arbitrariamente consultas que sostienen offline.

Medición de App.jsx: 1816→1847 líneas incluyendo las funciones nuevas, 55→52 estados y 12→11 efectos. Los 20 sitios literales anteriores de onSnapshot pasan a 4 directos y 14 llamadas al wrapper privado, además de hooks extraídos. **Esto no significa 80% menos suscripciones de ejecución**: se conserva el alcance previo y se agregan listeners necesarios para compartición/compensatorios/CEO. La cantidad en ejecución depende de rol, pestaña y compañeros. Las métricas de actividad/funciones y feedback del CEO siguen consultando sus colecciones completas en esta beta; deberán agregarse/paginarse con medición de escala, sin limitar el historial personal a ciegas.

Build local emulator: JS 1.110,29 kB, gzip 327,92 kB; CSS 56,03 kB. Build production explícito: JS 1.110,73 kB, gzip 328,09 kB. Persiste la advertencia de chunk >500 kB; no se ocultó. Antes de agregar más funciones conviene medir carga en teléfonos de gama baja y separar carga diferida del CEO/finanzas junto con precache completo de esos chunks. Esta misión no declara una mejora de Core Web Vitals.

Se actualizaron dependencias dentro de sus versiones mayores existentes; no se usó audit fix --force ni degradaciones. Override acotado de @grpc/grpc-js a ^1.14.6 dentro de @firebase/firestore; pasó lógica, SDK Node y reglas emuladas.

- npm audit --omit=dev: **0 avisos**.
- npm audit completo: **6 moderados, 0 altos, 0 críticos**. Pendientes de herramientas Node: firebase-tools y su cadena @google-cloud/pubsub/@opentelemetry/core, gaxios/uuid y re2. No se importan en el bundle web de producción. No significa riesgo cero de desarrollo: evitar inputs no confiables y seguir las correcciones upstream. Las sugerencias de degradar firebase-tools o forzar cambios incompatibles no se aplicaron.

## 8. Resultados exactos de verificación

| Control | Resultado local |
| --- | --- |
| npm run lint | Aprobado, sin errores |
| npm test con Firestore local | 140 aprobadas, 0 fallidas, 0 canceladas, 0 omitidas: 121 de lógica/unidades y 19 casos de reglas |
| Reglas | 15 casos generales + 4 compensatorios; propietario/usuario normal/claims/revocación, esquema, aislamiento, auditoría, consentimiento y consultas propias |
| Recorridos Playwright Chrome | 19 aprobados, 0 fallidos/omitidos; incluye los 12 recorridos anteriores y 7 nuevos |
| npm run test:all | Preflight demo/loopback y ejecución integrada de unidades, reglas, build emulator e interfaz |
| npm run build:emulator | Aprobado; advertencia de tamaño indicada arriba |
| npm run build con configuración production explícita | Aprobado, solo compilación local; no se ejecutó la app contra datos reales |
| npm run build sin configuración | Rechazo esperado antes de Firebase: configuration/invalid-environment, salida 1; es prueba negativa aprobada, no deploy fallido |
| npm audit --omit=dev | Salida 0; sin vulnerabilidades reportadas |
| npm audit completo | Salida 1 por 6 avisos moderados de desarrollo; pendiente, no aprobado como limpio |
| git diff --check | Aprobado; avisos de conversión LF/CRLF de Windows, sin errores de whitespace |

Casos nuevos cubiertos: ejemplo compensatorio obligatorio, doble envío sin duplicados, recarga y sincronización, eventos inmutables, compensación excesiva/cambio de dirección denegados, revisiones obsoletas rechazadas, corrección/anulación enlazadas, CEO sin lectura privada, vigencias y disponibilidad histórica, retirada/rotación, consentimiento/borrado sin borrar planes, censo inválido conservando el último válido, actualización PWA fallida y dos pestañas.

Las alarmas exportadas a ICS/Google Calendar se verificaron como archivos/borradores privados; su entrega la gestiona el calendario del teléfono y no se comprobó físicamente. Las alertas al abrir siguen funcionando dentro de la ventana configurada. **No se implementó Push ni entrega de alarmas con la app cerrada.**

### Fallos intermedios y omisiones

- Se corrigieron conflictos de importación duplicada de SDK en los tests, etiquetas accesibles inconsistentes y la carrera del formulario de compensatorios; se repitió la integración.
- Una ejecución sin emuladores disponibles falló por conexión rechazada; se reiniciaron y repitieron los controles. No se contó como aprobada.
- Un ensayo artificial que combinaba abortar rutas WebChannel, disableNetwork y recarga produjo una aserción interna del SDK. No se presenta como aprobado ni como bug de producción diagnosticado. Se reemplazó por una prueba más representativa con app compilada, caché PWA y desconexión real del contexto del navegador, que pasó recarga y sincronización. Mantener ese antecedente si aparece un síntoma similar en teléfonos/redes reales; no se parcheó internamente Firebase para ocultarlo.
- OAuth Google real, permisos de sistema, instalación física Android/iOS, recepción real de avisos y CI remoto: **no ejecutados**.
- Entorno Preview real, dominios OAuth y reglas nuevas desplegadas: **pendientes de configuración/publicación autorizada**, no comprobados por emuladores.

## 9. Evidencias visuales

21 capturas con cuentas ficticias, reproducibles por e2e/integral.spec.js: Roster, Equipo, Franco, Finanzas, Ajustes, CEO y Compensatorios en los tres anchos. Se inspeccionaron capturas relevantes; no se guardó contenido privado real.

- [Compensatorios móvil: dos saldos separados](audit/integral/compensatorios-390.png).
- [Roster escritorio](audit/integral/roster-1440.png).
- [CEO tablet](audit/integral/ceo-768.png).
- [Finanzas móvil](audit/integral/finanzas-390.png).
- [Ajustes y privacidad escritorio](audit/integral/ajustes-1440.png).

## 10. Publicación, reversión y límites pendientes

Pasos concretos: [INTEGRAL_RUNBOOK.md](docs/INTEGRAL_RUNBOOK.md). Configuración: [ENVIRONMENTS.md](docs/ENVIRONMENTS.md).

Orden futuro: revisar variables y política → aprobar reglas compatibles → autorizar frontend production → comprobar Google/dispositivos reales → actualizar manualmente censo y validar nueva medición. **No ejecutar automáticamente estos pasos a partir de este informe.** No hace falta crear un servicio pago para el CEO implementado.

Al revertir, conservar las reglas de compensatorios/revocación: volver a las reglas antiguas abriría la validación genérica de su historial. Tampoco aplanar vigencias ni borrar datos para que un frontend antiguo los entienda. Conservar versiones PWA completas y no borrar IndexedDB para forzar una actualización.

Antes de vender anuncios con clima activo se debe resolver la licencia del proveedor: Open-Meteo clasifica apps con publicidad como uso comercial y su API gratuita se limita a uso no comercial. No se contrató ningún plan ni se expuso una clave comercial. Fuentes consultadas: [Términos](https://open-meteo.com/en/terms), [Licencia/planes](https://open-meteo.com/en/pricing).

Pendientes prioritarios: publicación autorizada y chequeo físico; responsable/contacto/conservación y atención manual de solicitudes; decisión comercial del clima; seguimiento de avisos Node de desarrollo y tamaño del bundle. La implementación es revisable y útil para una beta controlada, pero todavía **no está operativa en producción** ni se afirma que sea infalible.
