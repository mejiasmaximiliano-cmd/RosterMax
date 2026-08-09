# Borrador de política de privacidad de RosterMax

> Pendiente antes de publicar: completar nombre o razón social, domicilio, correo de privacidad, jurisdicción, plazos de conservación y procedimiento definitivo de eliminación. Este documento debe recibir revisión legal.

## Responsable

- Responsable: `[COMPLETAR]`
- Domicilio: `[COMPLETAR]`
- Contacto de privacidad: `[COMPLETAR]`

## Información tratada

RosterMax puede almacenar:

- identificador de cuenta y correo cuando se vincula Google;
- nombre visible elegido por el usuario;
- configuración del roster y fecha de inicio de ciclo;
- empresa, sector, yacimiento, transporte y provincias indicadas;
- tareas, bitácoras y metas financieras creadas por el usuario;
- compañeros agregados y códigos de sincronización;
- localidad y coordenadas elegidas para consultar el clima.
- preferencia para alertas de cambios de turno.
- categoría y mensaje de los comentarios enviados durante la beta.

## Finalidades

Los datos se usan para calcular el roster, sincronizar la información que el usuario decide compartir, respaldar sus datos, mostrar el clima elegido, operar las funciones de planificación y responder a comentarios de la beta.

## Sincronización con compañeros

RosterMax no publica un directorio de trabajadores. Al compartir un código, otro usuario que lo conozca puede consultar únicamente:

- nombre visible;
- días de trabajo y descanso;
- fecha de inicio del ciclo.

No se incluyen correo, empresa, provincias, tareas, metas ni bitácoras.

Los enlaces de invitación contienen el mismo código privado. El destinatario ve una vista previa y debe confirmar una vinculación recíproca: cada participante podrá consultar el nombre visible y el roster mínimo del otro. La aplicación no comparte estos datos de forma recíproca hasta que el destinatario pulsa `Aceptar y compartir`.

## Alertas

Las alertas del sistema se activan únicamente después de que el usuario concede permiso en su dispositivo. En la versión actual se calculan localmente cuando se abre RosterMax; no se envían mediante un servicio Push con la aplicación cerrada.

## Proveedores

- Firebase procesa autenticación y almacenamiento en la nube.
- Open-Meteo recibe las coordenadas seleccionadas para responder consultas climáticas.
- Vercel aloja y distribuye la aplicación web.

Antes de incorporar pagos, analítica o nuevos proveedores, esta política debe actualizarse.

## Publicidad

RosterMax no debe vender información personal. Cualquier personalización de ofertas por ubicación o sector requerirá información clara y consentimiento cuando corresponda. Los anuncios deberán identificarse como contenido patrocinado.

## Derechos

El usuario podrá solicitar acceso, corrección y eliminación de sus datos mediante el contacto de privacidad indicado. La aplicación debe incorporar un flujo de exportación y eliminación antes de su lanzamiento comercial.

## Seguridad

RosterMax limita el acceso mediante autenticación y reglas de Firestore. Los privilegios administrativos se otorgan en el servidor y no mediante claves incluidas en el navegador.
