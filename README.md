# RosterMax

RosterMax ayuda a trabajadores con diagramas rotativos a organizar trabajo, descanso, compañeros y metas personales.

## Estado

La aplicación está preparada para una beta cerrada. Actualmente incorpora:

- cálculo de roster validado y probado para fechas pasadas y futuras;
- códigos de sincronización aleatorios sin enumerar usuarios;
- datos privados separados del roster mínimo que el usuario decide compartir;
- acceso administrativo privado mediante un registro protegido en Firestore, con compatibilidad para Firebase Custom Claims;
- clima por coordenadas confirmadas, con caché local;
- PWA con recursos propios disponibles después de la primera carga;
- Tailwind compilado localmente, sin CDN en producción.
- guía inicial para configurar el diagrama y el perfil;
- invitaciones mediante enlace, con vista previa y confirmación explícita;
- cálculo automático de los próximos francos compartidos;
- coincidencias agrupadas, búsqueda y listas acotadas para equipos grandes;
- vacaciones, carpeta médica, permisos, trabajo extra y rosters especiales sin alterar el diagrama base;
- alertas locales configurables para cambios de turno;
- planificación del franco por fecha, categoría, prioridad y tiempo disponible;
- presupuesto mensual, registro de gastos, dinero por día de franco y metas de ahorro;
- vinculación de una cuenta nueva y acceso separado para quienes ya tienen cuenta;
- campañas patrocinadas por zona y fecha, administradas desde la aplicación;
- métricas comerciales propias con consentimiento: actividad agregada, alcance, impresiones, clics y CTR;
- comentarios privados de los participantes de la beta para el administrador.

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm ci
npm run dev
```

Verificaciones:

```bash
npm test
npm run lint
npm run build
```

## Firebase

La configuración del cliente puede definirse mediante las variables listadas en `.env.example`. El dominio canónico de producción es `https://rostermax.vercel.app`. Antes de publicar hay que desplegar las reglas y activar el registro privado de la cuenta administradora.

Consultar [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

## Beta cerrada

La lista operativa para invitar al primer grupo se encuentra en [docs/BETA_LAUNCH.md](docs/BETA_LAUNCH.md).

## Privacidad

El borrador de la política se encuentra en [docs/PRIVACY_DRAFT.md](docs/PRIVACY_DRAFT.md). Debe completarse con la identidad y contacto del responsable antes de una publicación comercial.
