import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

// Public deployment metadata only. No credentials, users, Firebase, telemetry,
// writes or scheduled jobs. A nonce makes cached responses detectable.
export function createVersionHandler({ readManifest = () => readFile(join(process.cwd(), 'dist', 'version.json'), 'utf8'), now = () => new Date() } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(JSON.stringify({ error: 'GET required' })); return; }
    const nonce = new URL(req.url, 'https://rostermax.vercel.app').searchParams.get('check') || '';
    if (!/^[a-zA-Z0-9_-]{12,100}$/.test(nonce)) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Invalid check nonce' })); return; }
    try {
      const manifest = JSON.parse(await readManifest());
      if (!/^[a-f0-9]{40}$/.test(manifest.commit || '') || !/^[a-f0-9]{20}$/.test(manifest.build || '') || !manifest.version || !manifest.environment) throw new Error('Invalid manifest');
      res.statusCode = 200; res.end(JSON.stringify({ ...manifest, checkedNonce: nonce, checkedAt: now().toISOString() }));
    } catch { res.statusCode = 503; res.end(JSON.stringify({ error: 'Version currently unavailable' })); }
  };
}
export default createVersionHandler();
