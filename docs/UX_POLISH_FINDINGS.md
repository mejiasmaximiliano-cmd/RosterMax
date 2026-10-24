# Evidencia inicial — beta-0.8

Inspección del 24/10/2026, antes de editar el producto. Base local/remota `060833d`; frontend público `21bed25`, build `8f13a2998e55e6fa5900`. Árbol inicial: auditoría/evidencias anteriores sin seguimiento, conservadas. No hay AGENTS.md aplicable en el proyecto/ancestros. Se leyeron README, último informe y runbook.

Recorrido local con Auth/Firestore demo, cuenta ficticia, 14×14 iniciado el 1/10, fecha fija 24/10/2026, compañeros manual/vinculado no disponible, plan y gasto. Capturas de los seis paneles en claro/oscuro a 390, calendario adicional a 412 y 1440. No es una sesión productiva ni investigación con personas.

Problemas concretos que resolver:

1. Barra inferior: fondo al 90 %, permite leer texto detrás en una captura real de viewport, no solo en una captura larga.
2. Roster: estado/ciclo de hoy bajo la cuadrícula; próxima subida a **1291 px** del inicio en 390×844, después de una tarjeta alta de compensatorios. Hoy y una fecha consultada se explican en bloques separados y repetidos.
3. Compensatorios: resumen ocupa mucho alto, ayuda y descripción compiten con saldos/historial. Acciones de anular y compensar tienen estilo demasiado parecido; cerrar un borrador lo descarta sin aviso.
4. Equipo: explicación manual/vinculado y ausencia de fecha se repite por tarjeta, incluso para una carga manual que no tiene publicación remota.
5. Franco: tres entradas similares para crear plan en estado vacío; filtros en franja horizontal y vacíos poco específicos. Cerrar un plan editado no advierte.
6. Finanzas: edición de presupuesto ocupa el recorrido antes del registro de gasto; jerarquía del botón de gasto secundaria y textos extensos en el resumen. Se preservarán importes/fórmulas/monedas.
7. Cuenta: «Cuenta Blindada» y «Datos seguros» no son estados comprobables de sincronización. Mensajes mezclan tuteo/voseo y la confirmación de cuenta con la de escrituras.
8. Formularios/estado: conservar valores en error y avisar solo si se descarta una edición; los éxitos offline deben identificarse como locales, no como confirmación remota.

Se usarán estilos compartidos pequeños para botones/campos/estado, sin nuevas dependencias ni cambios globales de variables de color. Medir contraste de pares modificados y comparar los mismos datos/fecha. Reglas, motores, contratos de datos y consentimiento quedan fuera de las modificaciones.
