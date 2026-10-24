import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolveEnvironment } from './src/lib/environment.js'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  resolveEnvironment({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env });
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return {
  define: { __APP_VERSION__: JSON.stringify('beta-0.7'), __BUILD_COMMIT__: JSON.stringify(commit) },
  plugins: [react(), tailwindcss(), {
    name: 'complete-pwa-version',
    generateBundle(_options, bundle) {
      const source = readFileSync('public/sw.js', 'utf8');
      const hash = createHash('sha256').update(source).update(readFileSync('index.html'));
      for (const path of ['public/manifest.json', 'public/logo.svg', 'public/favicon.svg']) hash.update(readFileSync(path));
      for (const [name, file] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) hash.update(name).update(file.type === 'chunk' ? file.code : file.source);
      const id = hash.digest('hex').slice(0, 20);
      const assets = Object.keys(bundle).filter((name) => name.startsWith('assets/') && /\.(js|css)$/.test(name)).map((name) => '/' + name);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: source.replace('__BUILD_ID__', id).replace('/*__PRECACHE_ASSETS__*/', JSON.stringify(assets).slice(1, -1)) });
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: 'beta-0.7', commit, build: id, environment: mode === 'emulator' ? 'emulator' : process.env.VITE_APP_ENV || loadEnv(mode, process.cwd(), 'VITE_').VITE_APP_ENV, builtAt: new Date().toISOString() }) });
    },
  }],
  }
})
