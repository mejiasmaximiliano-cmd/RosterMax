# Configuración segura de Firebase

RosterMax usa autenticación anónima y Google, Cloud Firestore y un registro privado de administradores. También mantiene compatibilidad con el Custom Claim `admin: true`.

## Antes de publicar

1. Habilitar los proveedores `Anonymous` y `Google` en Firebase Authentication.
2. Desplegar las reglas versionadas:

   ```bash
   firebase deploy --only firestore:rules --project rostermax-60242
   ```

3. Buscar el UID de la cuenta propietaria en Firebase Authentication.
4. Crear desde Firebase Console el documento:

   `artifacts/roster-max-production/admins/{UID_DE_LA_CUENTA}`

   con el campo booleano `active: true`. Este documento no puede crearse ni modificarse desde la aplicación web.
5. Volver a abrir RosterMax. La navegación mostrará el apartado `CEO` cuando el registro esté activo.

Como alternativa para infraestructuras que ya lo utilicen, puede asignarse el Custom Claim `admin: true` con Firebase Admin SDK. Nunca debe otorgarse un rol desde el navegador ni guardarse una credencial de servicio en este repositorio.

## Migración de sincronización

Las versiones anteriores escribían en `users_registry`. Las reglas nuevas bloquean esa colección para impedir que un cliente enumere usuarios, provincias y patrones de trabajo.

Cada cuenta recibe un código aleatorio en:

`artifacts/roster-max-production/users/{uid}/settings/sync`

El roster mínimo compartible se publica usando el código como identificador en:

`artifacts/roster-max-production/public/data/sync_codes/{code}`

Las reglas permiten consultar un documento exacto, pero deniegan listar la colección completa.

Al aceptar un enlace, el invitado puede crear o actualizar exclusivamente el documento con su propio UID dentro de la lista de compañeros del remitente. Las reglas validan que el código de invitación pertenezca al remitente y que el código compartido pertenezca al usuario autenticado. Este permiso no permite leer otros datos privados ni añadir a terceros.

## Campañas y comentarios de beta

Las campañas viven en:

`artifacts/roster-max-production/public/data/ads/{campaignId}`

Solo un administrador activo puede crearlas, pausarlas o leer los comentarios recibidos. Los usuarios autenticados ven únicamente campañas activas cuya fecha y zona correspondan con su perfil.

Los comentarios enviados por participantes se guardan en:

`artifacts/roster-max-production/public/data/feedback/{feedbackId}`

No existe una lista pública de comentarios: solamente el remitente puede crearlos y el administrador puede leerlos.

## Métricas con consentimiento

La actividad técnica aceptada por cada participante se guarda en:

`artifacts/roster-max-production/public/data/activity/{uid}`

Cada usuario puede leer y borrar sólo su propio registro. El administrador puede listar estos documentos para construir cantidades agregadas; no contienen nombre, correo, empresa, ubicación ni contenido de la app.

Las vistas y clics de campañas se acumulan por usuario y campaña en:

`artifacts/roster-max-production/public/data/campaign_metrics/{campaignId}_{uid}`

Las reglas impiden falsificar la identidad, cambiar de campaña o aumentar un contador en más de una unidad por evento. Sólo el administrador puede listar el conjunto para calcular alcance, impresiones, clics y CTR.
