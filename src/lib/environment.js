const PRODUCTION_PROJECT = 'rostermax-60242';
const PRODUCTION_NAMESPACE = 'roster-max-production';
const PRODUCTION_ORIGIN = 'https://rostermax.vercel.app';
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const FIREBASE_FIELDS = {
  apiKey: 'VITE_FIREBASE_API_KEY', authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID', storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID', appId: 'VITE_FIREBASE_APP_ID',
};

function invalid(message) {
  const error = new Error(`Configuración de RosterMax: ${message}`);
  error.code = 'configuration/invalid-environment';
  throw error;
}

/** Pure validation, shared by Vite and the browser, before Firebase starts. */
export function resolveEnvironment(env, { hostname } = {}) {
  const environment = env.VITE_APP_ENV || (env.VITE_USE_EMULATORS === 'true' ? 'emulator' : '');
  if (!['emulator', 'preview', 'production'].includes(environment)) invalid('elige VITE_APP_ENV=emulator, preview o production. Para pruebas locales usa npm run dev:emulator.');
  if (env.VERCEL_ENV === 'preview' && environment !== 'preview') invalid('Vercel Preview requiere un entorno preview aislado; no se admite configuración de producción ni emuladores.');
  if (env.VERCEL_ENV === 'production' && environment !== 'production') invalid('el despliegue de producción requiere configuración production explícita.');
  if (env.VITE_USE_EMULATORS === 'true' && environment !== 'emulator') invalid('el modo de emuladores contradice VITE_APP_ENV.');
  const isEmulator = environment === 'emulator';
  const publicAppUrl = env.VITE_PUBLIC_APP_URL || (isEmulator ? 'http://127.0.0.1:5173' : '');
  let publicUrl;
  try { publicUrl = new URL(publicAppUrl); } catch { invalid('define VITE_PUBLIC_APP_URL con el origen de este entorno.'); }
  if (publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash || publicUrl.pathname !== '/') invalid('VITE_PUBLIC_APP_URL debe ser un origen, sin credenciales, ruta ni parámetros.');
  if (isEmulator ? !LOOPBACK.has(publicUrl.hostname) || publicUrl.protocol !== 'http:' : publicUrl.protocol !== 'https:') invalid('usa HTTP local para emuladores y HTTPS para preview/producción.');
  if (hostname && (isEmulator ? !LOOPBACK.has(hostname) : hostname !== publicUrl.hostname)) invalid('el dominio abierto no corresponde al entorno configurado.');
  const appId = env.VITE_DATA_NAMESPACE || (isEmulator ? PRODUCTION_NAMESPACE : '');
  if (!/^[a-z][a-z0-9-]{2,79}$/.test(appId)) invalid('define VITE_DATA_NAMESPACE para este entorno.');
  let firebaseConfig;
  if (isEmulator) {
    if (env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_PROJECT_ID !== 'demo-rostermax') invalid('los emuladores sólo admiten demo-rostermax.');
    firebaseConfig = { apiKey: 'demo-rostermax', projectId: 'demo-rostermax', authDomain: 'localhost', storageBucket: 'demo-rostermax.local', messagingSenderId: '1234567890', appId: '1:1234567890:web:emulator' };
  } else {
    firebaseConfig = Object.fromEntries(Object.entries(FIREBASE_FIELDS).map(([field, variable]) => {
      const value = String(env[variable] || '').trim();
      if (!value || /^(?:example|replace|your-|\[|<)/i.test(value)) invalid(`falta ${variable}; no se usará un respaldo de producción.`);
      return [field, value];
    }));
    const { projectId, authDomain, storageBucket, messagingSenderId, appId: webAppId } = firebaseConfig;
    if (!/^[a-z][a-z0-9-]{4,29}$/.test(projectId) || authDomain !== `${projectId}.firebaseapp.com`
      || ![`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`].includes(storageBucket)
      || !/^\d+$/.test(messagingSenderId) || !webAppId.startsWith(`1:${messagingSenderId}:web:`)) invalid('proyecto, dominio, bucket y aplicación Firebase deben pertenecer a la misma configuración.');
    if (environment === 'production' && (projectId !== PRODUCTION_PROJECT || appId !== PRODUCTION_NAMESPACE || publicUrl.origin !== PRODUCTION_ORIGIN)) invalid('la configuración de producción no coincide con el proyecto, espacio y dominio existentes.');
    if (environment === 'preview' && (projectId === PRODUCTION_PROJECT || appId === PRODUCTION_NAMESPACE || publicUrl.origin === PRODUCTION_ORIGIN || projectId.startsWith('demo-'))) invalid('preview necesita un proyecto, espacio y dominio aislados de producción.');
  }
  let ceoApiUrl = env.VITE_CEO_API_URL || '';
  if (ceoApiUrl) {
    let api;
    try { api = new URL(ceoApiUrl); } catch { invalid('VITE_CEO_API_URL no es una URL válida.'); }
    if (isEmulator ? !LOOPBACK.has(api.hostname) || api.protocol !== 'http:' : api.origin !== publicUrl.origin) invalid('la API CEO debe pertenecer a este entorno.');
    ceoApiUrl = api.href.replace(/\/$/, '');
  }
  return Object.freeze({ environment, isEmulator, firebaseConfig, projectId: firebaseConfig.projectId, appId, publicAppUrl: publicUrl.origin, ceoApiUrl });
}
