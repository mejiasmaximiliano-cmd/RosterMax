# RosterMax

RosterMax ayuda a trabajadores con diagramas rotativos a organizar trabajo, descanso, compañeros y metas personales.

## Estado

La aplicación está en fase de endurecimiento técnico. Las dos primeras fases incorporan:

- cálculo de roster validado y probado para fechas pasadas y futuras;
- códigos de sincronización aleatorios sin enumerar usuarios;
- datos privados separados del roster mínimo que el usuario decide compartir;
- roles administrativos mediante Firebase Custom Claims;
- clima por coordenadas confirmadas, con caché local;
- PWA con recursos propios disponibles después de la primera carga;
- Tailwind compilado localmente, sin CDN en producción.
- guía inicial para configurar el diagrama y el perfil;
- invitaciones mediante enlace, con vista previa y confirmación explícita;
- cálculo automático de los próximos francos compartidos;
- alertas locales configurables para cambios de turno;
- metas financieras con aportes libres y proyección mensual.

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

La configuración del cliente puede definirse mediante las variables listadas en `.env.example`. Antes de publicar hay que desplegar las reglas y asignar el rol administrativo desde un entorno seguro.

Consultar [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md).

## Privacidad

El borrador de la política se encuentra en [docs/PRIVACY_DRAFT.md](docs/PRIVACY_DRAFT.md). Debe completarse con la identidad y contacto del responsable antes de una publicación comercial.
