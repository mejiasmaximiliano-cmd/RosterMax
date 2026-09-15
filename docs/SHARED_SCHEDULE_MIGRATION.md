# Disponibilidad compartida: migración v1

El calendario privado conserva sus objetos, tipos y notas. El documento de código compartido guarda `exceptions` como hasta 30 strings:

- `N|inicio|fin`: no disponible, sin motivo médico o de licencia.
- `R|inicio|fin`: descanso.
- `W|inicio|fin`: trabajo.
- `C|inicio|fin|díasTrabajo|díasDescanso|inicioCiclo`: ciclo temporal.

Fechas ISO `YYYY-MM-DD`, ciclos de 1 a 365 días. Las reglas rechazan mapas nuevos y cualquier campo libre; el codificador y el lector además comprueban fechas reales y orden de intervalos. El formato compacto permite verificar los 30 elementos dentro del límite de expresiones de Firestore.

## Compatibilidad y orden de publicación

1. Publicar el frontend que escribe v1 y lee tanto v1 como objetos antiguos. Su publicación propia reemplaza el documento compartido sin `merge`.
2. Publicar las reglas v1 para que clientes antiguos no vuelvan a escribir mapas con motivos privados.
3. Revisar los documentos compartidos antiguos y migrarlos con el script abajo. Comprobar de nuevo hasta que `legacy`, `invalid`, `conflicts` y `failed` estén en cero; los inválidos requieren revisión, nunca se descartan parcialmente.

Un cliente viejo debe actualizar la PWA: sus escrituras antiguas se rechazarán y no entenderá excepciones v1. El calendario privado no se borra ni se migra. Un usuario que abre la nueva versión reemplaza automáticamente su copia compartida cuando carga su roster, perfil y excepciones confirmados por el servidor.

## Revisión administrativa

`node scripts/migrate-shared-schedules.mjs` es sólo lectura por defecto. `--apply` activa las modificaciones. El proyecto `rostermax-60242`, la base `(default)` y la colección pública exacta están fijados en el script; no se admiten destinos arbitrarios.

Usa la sesión ya guardada por Firebase CLI y sus permisos IAM de Firestore. No pide claves nuevas ni escribe tokens o datos de usuarios en la salida. Pagina con máscara de lectura `exceptions`, convierte en memoria y muestra únicamente conteos. No usar opciones de depuración.

Cada actualización tiene máscara `exceptions`, fecha de servidor `updatedAt` y precondición `updateTime`. Si otro dispositivo modifica el documento durante la revisión, se registra conflicto y se conserva el cambio concurrente. El script omite documentos inválidos o con más de 30 entradas completos; puede volver a ejecutarse después. No guarda una copia adicional de motivos privados.

Salida 0: recorrido completo sin incidencias; 2: registros inválidos, conflictos o fallos individuales; 1: error general. En una ejecución interrumpida puede haber modificaciones ya aplicadas; se puede volver a ejecutar de forma segura porque los documentos v1 válidos no se reescriben.
