# Publicación, configuración y reversión — no ejecutadas

Esta misión no hizo push, merge, deploy ni escrituras en producción. Los pasos siguientes requieren una autorización posterior. No ejecutar el script de diagnóstico con `--publish` durante una revisión de solo lectura.

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
