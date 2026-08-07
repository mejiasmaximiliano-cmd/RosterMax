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

## Campañas y comentarios de beta

Las campañas viven en:

`artifacts/roster-max-production/public/data/ads/{campaignId}`

Solo un administrador activo puede crearlas, pausarlas o leer los comentarios recibidos. Los usuarios autenticados ven únicamente campañas activas cuya fecha y zona correspondan con su perfil.

Los comentarios enviados por participantes se guardan en:

`artifacts/roster-max-production/public/data/feedback/{feedbackId}`

No existe una lista pública de comentarios: solamente el remitente puede crearlos y el administrador puede leerlos.
