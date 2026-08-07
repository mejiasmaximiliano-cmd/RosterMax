# Configuración segura de Firebase

RosterMax usa autenticación anónima y Google, Cloud Firestore y Custom Claims.

## Antes de publicar

1. Habilitar los proveedores `Anonymous` y `Google` en Firebase Authentication.
2. Desplegar las reglas versionadas:

   ```bash
   firebase deploy --only firestore:rules --project rostermax-60242
   ```

3. Asignar el Custom Claim `admin: true` únicamente a la cuenta propietaria mediante un entorno seguro con Firebase Admin SDK. Nunca asignarlo desde el navegador ni guardar credenciales de servicio en este repositorio.
4. Cerrar y volver a iniciar la sesión administrativa para renovar el token.

## Migración de sincronización

Las versiones anteriores escribían en `users_registry`. Las reglas nuevas bloquean esa colección para impedir que un cliente enumere usuarios, provincias y patrones de trabajo.

Cada cuenta recibe un código aleatorio en:

`artifacts/roster-max-production/users/{uid}/settings/sync`

El roster mínimo compartible se publica usando el código como identificador en:

`artifacts/roster-max-production/public/data/sync_codes/{code}`

Las reglas permiten consultar un documento exacto, pero deniegan listar la colección completa.
