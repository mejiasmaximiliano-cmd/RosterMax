# Misión integral — registro de avance local

Base: main `8db6d54eee2c934c651e42e1e7a0233abe3a4875`.
Rama: `codex/integral-reliability-ceo-compensatorios`.
Trabajo previo conservado: `ROSTERMAX_AUDIT_REPORT.md` y `audit/`, inicialmente sin seguimiento.
No se autoriza push, merge, deploy ni escrituras en Vercel/Firebase de producción.

## Etapa 1

- Configuración pura compartida entre Vite y navegador: emulator/preview/production.
- Configuración ausente o parcial se rechaza antes de Auth/Firestore.
- Proyecto y namespace actuales preservados únicamente con configuración explícita de producción.
- Censo e invitaciones reciben proyecto/origen del entorno; no tienen destino de respaldo de producción.
- Nueve pruebas específicas aprobadas y build de emuladores aprobado.
- Build sin configuración rechazado como prueba negativa esperada.
- Dependencias actualizadas dentro de las versiones mayores actuales. gRPC fijado a una versión menor compatible corregida; pendiente completar regresión de SDK Node con emuladores.

## Diagnóstico CEO preliminar, lectura autorizada 24/10/2026 04:09 UTC

- Auth: 185 cuentas técnicas = 4 vinculadas Google + 181 invitadas, 0 deshabilitadas.
- Muestra voluntaria: 1 cuenta; 1 activa medida en 24h/7d/30d; 1 instalación detectada.
- 57 documentos públicos de roster no equivalen a personas/usuarios activos.
- Ninguna interacción de campaña medida. No implica necesariamente ausencia de anuncios vistos sin consentimiento.
- Las consultas auxiliares collection-group de settings siguen indisponibles (400), no deben convertirse en ceros.
- No se publicó ni actualizó el censo real. Falta conciliar fecha del snapshot guardado, registro admin y custom claims mediante lecturas mínimas.

## Etapas siguientes

CEO verificable e instrumentación voluntaria; compensatorios privados independientes; offline/PWA/revocación; vigencias; experiencia/accesibilidad y privacidad; integración y reporte final.

## Implementación e integración en curso

- Compensatorios: cabeceras privadas y eventos inmutables en lotes atómicos, enteros de medio día, compensaciones enlazadas, correcciones/anulaciones y cola persistente. Cuatro pruebas de motor y cuatro de reglas aprobadas.
- Calendario: vigencias permanentes manteniendo el motor; wire v2 con base/cambios de disponibilidad sin notas, compatible con formato v1. Prueba de igualdad de 732 fechas y derivados antes/después de compensatorios aprobada.
- Revocación: settings/sync.enabled, rotación de código, denegaciones de lectura/publicación por código retirado; eliminación de compañero sigue siendo solo gestión de lista.
- Offline: metadatos de listeners originales (sin duplicar consultas privadas) muestran pendiente/caché/confirmado tras recarga.
- CEO: fuente de datos extraída a useCeoData; último resultado válido ante fallos/caché, censo manual, desgloses de altas, uso de funciones voluntario con IDs estables, feedback atendible y registro administrativo mínimo.
- Lectura adicional de producción 24/10/2026 04:25 UTC: snapshot del censo del 26/09/2026, total150/registradas4/invitadas146; registro administrativo: 1 activo; esa identidad no tiene custom claim admin. No se escribieron datos.
- Acceso admin: registro inactivo prevalece ante un claim antiguo; regla y frontend coherentes, sin comparación de correo ni nuevos administradores.
- PWA: caché por build, instalación completa antes de aceptar HTML, sin skipWaiting; conserva versión anterior. Pendiente completar ensayo de dos pestañas/actualización interrumpida.
- Privacidad: exportación privada, borrado de medición propia y solicitud de eliminación atendida manualmente; no inventa responsable/contacto ni promete borrado automático.
- Integración: suite Node+reglas actual completa **139 aprobadas, 0 fallidas, 0 omitidas**. Recorridos UI ampliados en curso; un intento previo fue cancelado porque los emuladores habían terminado, y se reiniciaron localmente antes de repetir. No contarlo como aprobación.

## Cierre de integración

- `npm run test:all` con Auth/Firestore loopback y GCLOUD_PROJECT=demo-rostermax: **140 unidades/reglas aprobadas y 19 recorridos UI aprobados**, sin omisiones ni fallos finales.
- Lint y diff --check aprobados. Build sin configuración rechazado de forma esperada. Build production explícito aprobado solo en local; dist se dejó reconstruido en modo emulator para pruebas seguras.
- npm audit --omit=dev: 0 avisos. Audit completo: 6 moderados de herramientas de desarrollo, 0 altos/críticos; pendientes documentados.
- PWA compilada con desconexión real, recarga y reconexión: movimiento pendiente conservado y sincronizado una vez. Actualización fallida/dos pestañas aprobadas. Un ensayo artificial WebChannel descartado como validación dejó un antecedente SDK documentado en el reporte.
- Producción leída sin escrituras: registro admin1 activo; custom claims de las185 cuentas revisados sin identidades conservadas, admin claims0. Censo guardado antiguo sin actualizar.
- Evidencias nuevas:21 capturas y resumen administrativo agregado en audit/integral. Auditoría previa preservada.
- Entrega: ROSTERMAX_INTEGRAL_REPORT.md y docs/INTEGRAL_RUNBOOK.md. Pendiente publicación autorizada, OAuth/dispositivos físicos, datos reales del responsable y decisión comercial del clima. No hay push, merge, deploy ni cambios de permisos/datos de producción.
