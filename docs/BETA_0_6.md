# RosterMax beta 0.6

## Panel CEO

El panel separa el censo de Firebase Authentication de la muestra voluntaria de actividad. El censo muestra cuentas vinculadas, cuentas Google, invitados y total técnico, con fecha de actualización. Los invitados no son personas ni instalaciones únicas. El propietario puede actualizarlo mediante autorización Google con permisos IAM del proyecto. Nunca se muestra un error de lectura como un cero confirmado.

Los usuarios activos de 24 horas, 7 y 30 días siguen siendo una muestra de quienes aceptaron medición. La app renueva la actividad mientras está visible, sin recolectar contenido privado ni cambiar el consentimiento existente. Los accesos de autenticación se muestran aparte: no equivalen a abrir la app.

Ver [operación del censo](CEO_ACCOUNT_CENSUS.md). La consulta administrativa también permite cargar un primer censo agregado sin cambiar cuentas de usuarios.

## Recordatorios de planes y ahorro

Después de guardar un plan o una meta pendiente, desplegar **Recordatorio en mi calendario**. Elegir fecha, hora, anticipación y, opcionalmente, repetición mensual. En meses cortos, los días 29–31 se ajustan al último día disponible.

- **Google Calendar:** abre un borrador. El usuario debe guardarlo y añadir o confirmar la notificación.
- **Archivo .ics:** incluye un aviso `VALARM`. Debe importarse en un calendario compatible y comprobar sus permisos.

No son notificaciones Push propias ni alarmas nativas garantizadas. La entrega depende del calendario y del teléfono. No se contratan nuevos servicios. Los nombres son opcionales y no se exportan montos; modificar el plan o completar la meta no modifica el evento copiado. Las importaciones repetidas pueden duplicarlo.

## Clima

La tarjeta abre siete días de pronóstico con selección diaria y detalle horario: temperatura, lluvia, viento y ráfagas. Las horas corresponden a la localidad seleccionada. Los datos del modelo meteorológico y la hora de consulta se distinguen. Se reutiliza caché por 30 minutos y, si falla la conexión, respaldo identificado de hasta seis horas.

La información es orientativa y no sustituye avisos oficiales ni protocolos del yacimiento. Antes de monetizar la app con publicidad, revisar y contratar una licencia/API comercial de Open-Meteo o elegir un proveedor compatible con el uso comercial; esta versión no activa pagos ni cambia la suscripción.

## Simulador

El resultado propio y el de cada compañero incluyen el día dentro de su fase: por ejemplo, **Día 10 de 14 de trabajo** o **Día 5 de 7 de franco**. Se respetan los cambios temporales y se mantiene oculta la causa privada de las ausencias de compañeros. Los rosters no sincronizados se identifican como no disponibles.

## Verificación

`npm run lint`, `npm run build`, `npm test` con Firestore Emulator y `npm run test:e2e` con emuladores Auth/Firestore. Las pruebas de navegador usan datos locales y bloquean peticiones de producción. La autorización Google real y los avisos del calendario en un teléfono deben confirmarse manualmente por el propietario/usuario; ninguna prueba local simula que esos permisos reales fueron concedidos.
