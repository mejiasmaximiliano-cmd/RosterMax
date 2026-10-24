# Atención de feedback y solicitudes de privacidad

Procedimiento operativo del propietario. No crea un servicio automático ni promete plazos o cumplimiento legal. No se ejecutaron eliminaciones reales en esta misión.

1. **Revisar:** entrar con la cuenta propietaria autorizada a CEO → Feedback y atención. Revisar pendientes y también Todos cuando sea necesario; conservar comentarios y estados. Las solicitudes de eliminación llegan por el feedback existente como categoría `privacy`.
2. **Clasificar:** problema de acceso, error funcional, duda o solicitud de privacidad. No pedir contraseñas, códigos OAuth, información bancaria o motivos médicos por feedback. El código compartido del roster no prueba identidad: puede reenviarse.
3. **Identidad:** para una operación que afecte datos/cuenta, comprobar la titularidad de la cuenta exacta usando un canal y procedimiento verificados. La app identifica técnicamente al remitente autenticado, pero eso no reemplaza la verificación necesaria para una eliminación. No inventar un contacto alternativo ni usar el correo personal del propietario como soporte sin configurarlo expresamente.
4. **Atender:** pasar a En atención cuando se comienza. Una exportación privada la inicia el usuario en Ajustes; no solicitar que envíe el archivo sensible a un canal público. Si es un error, reproducir con datos ficticios y registrar versión/tarea, no contenidos privados.
5. **Eliminación manual:** pulsar Solicitar eliminación **solo registra un pedido**. Antes de ejecutar cualquier borrado real, definir responsable/operador autorizado, identidad, alcance (Auth y datos asociados, compartición y copias), retención y confirmación. Borrar solo Auth no demuestra que desaparecieron los documentos de Firestore. Si falta alguno de esos requisitos, mantener el pedido en atención; no declarar borrado completo. Cerrar sesión/desinstalar tampoco borra la cuenta.
6. **Registrar resolución:** usar los estados existentes Nuevo / En atención / Resuelto. Marcar Resuelto solo después de verificar la acción o respuesta; el cambio queda en la actividad administrativa existente. El panel no tiene un campo de notas internas: si hace falta un registro operativo adicional, conservar solo ID del pedido, tipo, acción comprobada y fecha en un lugar privado definido por el propietario, no en el repositorio público.

## Pendientes concretos del propietario

- Nombre/razón social y datos reales del responsable, jurisdicción y domicilio cuando corresponda.
- Contacto de privacidad/soporte expresamente destinado a ese fin; no se publicó un correo personal. La UI solo muestra contacto si están configurados `VITE_PRIVACY_CONTACT_EMAIL` y `VITE_PRIVACY_CONTROLLER` válidos.
- Política final y conservación, canal de respuesta verificable, procedimiento de identidad y alcance de eliminación, acceso al registro operativo y retención de notas del piloto.

No hay garantía de respuesta en un plazo inventado ni eliminación automática. El piloto de compañeros no subsana esos requisitos comerciales/de privacidad.
