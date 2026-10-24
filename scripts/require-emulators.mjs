import process from 'node:process';
for (const variable of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[variable] || '')) throw new Error(`${variable} debe apuntar explícitamente a un emulador loopback. No se permite omitir pruebas de reglas en la verificación integral.`);
}
if ((process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT) !== 'demo-rostermax') throw new Error('La verificación integral requiere el proyecto ficticio demo-rostermax.');
process.stdout.write('Preflight: Auth/Firestore locales y proyecto ficticio confirmados.\n');
