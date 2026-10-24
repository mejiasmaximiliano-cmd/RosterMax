# Evidencias beta-0.8

Las capturas funcionales se generan exclusivamente con cuentas y datos ficticios en emuladores locales. No se cambió el tema de la cuenta real del propietario, su código ni sus compañeros para generar evidencia.

- `historia-{1..5}-{light,dark}-390.png`: mismos ejemplos de octubre de 2026 y viewport 390 × 844. Las demostraciones se accionaron antes de capturar; los controles inferiores permanecen visibles y el contenido vertical se desplaza dentro del diálogo.
- `faq-{light,dark}-{768,1440}.png`: mismos datos y viewport 768/1440 × 900.
- `compartir-global-light-412.png`, `quitar-companero-light-412.png`: viewport predeterminado Pixel 7, 412 × 839; confirmaciones con cuenta ficticia. Se prueba Cancelar sin escrituras y rechazo del servidor solo en emulador.
- `ceo-cobertura-light-412.png`: mismo viewport móvil, muestra de actividad ficticia y filtros; no es censo real ni evidencia de uso en producción.
- `version-lista-light-412.png`: mismo viewport móvil, ciclo de worker controlado en prueba de interfaz; no acredita actualización de una PWA física.
- `regression/`: interfaz existente y medición fría local en Chrome/loopback, sin throttling ni worker en la medición inicial. No representa velocidad del teléfono ni Core Web Vitals productivos.

Los archivos `production-check.json` y `production-readonly-session-gate-390.png`, cuando se generan, corresponden a recursos públicos reales después del despliegue. La prueba intercepta Auth antes de crear una cuenta, así que la pantalla de error de sesión es **deliberada**, no una incidencia del servicio. No recorre la cuenta del propietario ni confirma OAuth real.

La evidencia exacta del SHA público, build, fecha, recursos y límites queda en `production-check.json` y `ROSTERMAX_WELCOME_REPORT.md`. No extrapolar ninguna captura ficticia como métricas comerciales o instalación real.
