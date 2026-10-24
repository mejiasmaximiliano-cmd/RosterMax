# Entornos explícitos

La aplicación no contiene configuración de respaldo hacia producción. Vite y el navegador validan el entorno antes de inicializar Firebase. `import.meta.env.PROD` no selecciona el proyecto.

## Local

`npm run dev:emulator` y `npm run build:emulator` cargan `.env.emulator`. Auth y Firestore usan exclusivamente `demo-rostermax`, en 9096/8086. No hacen falta credenciales reales. La variable heredada `VITE_USE_EMULATORS=true` sigue siendo una selección explícita compatible para las pruebas anteriores; no permite seleccionar otro proyecto.

## Preview

Usar `.env.example` como lista de variables. Se necesita un proyecto Firebase distinto, namespace distinto y URL HTTPS propia. Una preview sin esos valores falla antes de crear invitados. No utilizar el proyecto actual como staging ni cargar credenciales de servicio en variables `VITE_*`. El cliente sólo admite configuración pública Firebase.

## Producción existente

`.env.production.example` documenta los identificadores públicos que deben conservarse. No se carga automáticamente: configurar explícitamente esas variables y la API key pública del cliente en el entorno de build autorizado. El namespace continúa siendo `roster-max-production` y el proyecto `rostermax-60242`: no hay migración de cuentas ni de rutas por este cambio.

El dominio abierto debe corresponder con `VITE_PUBLIC_APP_URL`. Una URL de preview de Vercel necesita configuración preview aislada. `npm run build` sin configuración se rechaza intencionalmente. El acceso a producción y su configuración no se modifican en esta misión.

No se implementó ni desplegó una API CEO: el censo conserva actualización manual con OAuth administrativo. VITE_CEO_API_URL está reservado y debe dejarse vacío. Su validación impide aceptar un origen ajeno, pero configurar esa variable no habilita un servicio. Invitaciones y consultas del censo reciben el destino de este mismo entorno, sin fallback fijo de producción.
