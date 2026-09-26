# Cuentas, actividad e instalaciones

El censo de cuentas y la medición opcional responden a preguntas distintas. El censo consulta Firebase Authentication y cuenta cuentas guardadas con proveedor, cuentas invitadas y cuentas deshabilitadas. Una cuenta invitada puede corresponder a una visita, otro navegador o un dispositivo nuevo; no equivale a una persona distinta ni a una instalación.

La colección `activity` continúa siendo voluntaria. Las cifras de activos e instalaciones detectadas representan sólo esa muestra. No se puede reconstruir cuántos dispositivos instalaron la PWA antes de que se registrara el evento ni cuántos siguen instalados. `lastLoginAt` de Firebase representa autenticación, no apertura de la app: no debe llamarse DAU, WAU ni MAU.

## Actualización del censo

El CEO guarda un snapshot privado en `artifacts/roster-max-production/admin_stats/accounts`, con fecha de servidor `generatedAt`. El panel debe mostrar esa fecha y conservar el último resultado completo si una consulta falla. No presentar un error o dato ausente como cero.

La actualización desde el navegador requiere una acción del administrador, reautenticación Google y el scope `https://www.googleapis.com/auth/identitytoolkit`. La cuenta Google necesita además permisos IAM `firebaseauth.users.get` del proyecto; tener una bandera de administrador de la app por sí sola no concede esos permisos. El acceso temporal se mantiene únicamente en memoria y se descarta al terminar. No se guarda en Firestore, almacenamiento del navegador, archivos ni logs.

`fetchAccountCensus` pagina hasta completar la respuesta de Firebase, con máscara de campos que excluye UID, correo, nombre y hashes. Una respuesta fallida, token repetido, límite de páginas o timeout rechaza el resultado entero. La publicación sólo incluye contadores y metadatos. Las reglas permiten leer ese documento exacto y actualizar su esquema cerrado únicamente a administradores; los usuarios normales no pueden consultarlo.

No es una medición automática permanente: para que el censo cambie, el administrador debe actualizarlo. Un backend programado con credenciales de servidor y permisos mínimos sería una evolución posterior. No se activan pagos, APIs ni servicios para esta implementación.

## Diagnóstico y carga administrativa

- `node scripts/diagnose-ceo.mjs`: lectura de Auth, consultas agregadas de Firestore y estado de facturación. No habilita servicios ni muestra identidades.
- `node scripts/diagnose-ceo.mjs --publish`: además reemplaza exclusivamente el snapshot del censo del CEO, tras completar la consulta de Auth. No cambia las preferencias de privacidad ni métricas opcionales de los usuarios.

El proyecto, la base y el destino están fijados en el código. La sesión administrativa existente de Firebase CLI autentica las consultas sin exportar credenciales. Los errores de consultas agregadas secundarias se muestran como indisponibles y no se confunden con cero. El snapshot contiene recuentos de cuentas, no audiencia humana auditada ni conversiones publicitarias.

Referencias: [Listado paginado de cuentas](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/projects.accounts/batchGet), [significado de los campos de cuenta](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v1/UserInfo), [consultas agregadas de Firestore](https://docs.cloud.google.com/firestore/docs/reference/rest/v1/projects.databases.documents/runAggregationQuery).
