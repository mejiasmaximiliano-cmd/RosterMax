import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolveEnvironment } from './src/lib/environment.js'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  resolveEnvironment({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env });
  return {
  plugins: [react(), tailwindcss(), {
    name: 'complete-pwa-version',
    generateBundle(_options, bundle) {
      const source = readFileSync('public/sw.js', 'utf8');
      const hash = createHash('sha256').update(source).update(readFileSync('index.html'));
      for (const path of ['public/manifest.json', 'public/logo.svg', 'public/favicon.svg']) hash.update(readFileSync(path));
      for (const [name, file] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) hash.update(name).update(file.type === 'chunk' ? file.code : file.source);
      const id = hash.digest('hex').slice(0, 20);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: source.replace('__BUILD_ID__', id) });
    },
  }],
  }
})
