import process from 'node:process';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolveEnvironment } from '../src/lib/environment.js';

// Explicit, versioned PUBLIC web-app configuration, not credentials. This entry
// point is selected only for the authorized production deployment or locally
// with --production. Never used by generic builds, emulator or preview.
if (process.env.VERCEL_ENV !== 'production' && !(process.argv.includes('--production') && !process.env.VERCEL_ENV)) throw new Error('Este comando solo construye Production. No se necesita preview para esta entrega.');
const configured = JSON.parse(readFileSync(new URL('../config/production.public.json', import.meta.url), 'utf8'));
for (const [name, value] of Object.entries(configured)) {
  if (process.env[name] && process.env[name] !== value) throw new Error(`Variable ${name} contradictoria con la configuración Production revisada; se detuvo el build.`);
}
const env = { ...process.env, ...configured };
resolveEnvironment(env);
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'production'], { env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
