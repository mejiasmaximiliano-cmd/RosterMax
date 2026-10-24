# Narración de Conocé RosterMax — pendiente, no integrada

La entrega beta-0.8 funciona completamente con texto y demostraciones interactivas. No se dispuso de una herramienta de locución autorizada. No se generaron, escucharon ni aprobaron audios; no aparecen botones de audio sin contenido.

## Recurso concreto que falta

Cinco grabaciones revisadas en español latino con voseo, cálidas y conversadas. Los guiones vigentes están en `src/lib/helpContent.js`, arreglo `STORIES`; usar esos textos, no otra copia que pueda desactualizarse. Revisar escuchando especialmente «roster», «franco», «subida» y «compensatorios».

Ruta prevista (todavía no existen los archivos): `public/audio/welcome/{roster,crew,plans,comp,finance}.mp3`. Solo después de revisar cada audio, establecer el `audioSrc` correspondiente. No contratar servicios ni crear cuentas como parte de esta preparación.

`WelcomeStories.jsx` contiene el punto de integración: descarga al tocar Escuchar explicación, pausa/repetición, texto equivalente, error legible y detención al cambiar de escena o cerrar. Con `audioSrc: null` ese código permanece inactivo. Su funcionamiento con grabaciones reales y una descarga fallida queda pendiente de prueba; no se considera validado por las pruebas sin audio.

Los audios no deben entrar en el precache obligatorio de la PWA: la falta de una grabación no puede bloquear el inicio ni una actualización. Validar móvil real, teclado, cierre, cambio de historia, pausa y descarga fallida antes de habilitarlos.
