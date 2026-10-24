import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEnvironment } from '../src/lib/environment.js';

const preview = { VITE_APP_ENV: 'preview', VITE_DATA_NAMESPACE: 'roster-max-preview', VITE_PUBLIC_APP_URL: 'https://preview.example.test', VITE_FIREBASE_API_KEY: 'public-test-key', VITE_FIREBASE_PROJECT_ID: 'rostermax-preview', VITE_FIREBASE_AUTH_DOMAIN: 'rostermax-preview.firebaseapp.com', VITE_FIREBASE_STORAGE_BUCKET: 'rostermax-preview.firebasestorage.app', VITE_FIREBASE_MESSAGING_SENDER_ID: '123', VITE_FIREBASE_APP_ID: '1:123:web:abc' };
test('missing and partial configuration cannot fall through to production', () => {
  for (const env of [{}, { PROD: true }, { VITE_APP_ENV: 'production' }, { ...preview, VITE_FIREBASE_API_KEY: '' }, { ...preview, VITE_FIREBASE_AUTH_DOMAIN: 'rostermax-60242.firebaseapp.com' }]) assert.throws(() => resolveEnvironment(env), /Configuración de RosterMax/);
});
test('explicit emulators remain local regardless of build DEV/PROD flags', () => {
  for (const PROD of [true, false]) {
    const config = resolveEnvironment({ VITE_APP_ENV: 'emulator', PROD }, { hostname: '127.0.0.1' });
    assert.equal(config.projectId, 'demo-rostermax'); assert.equal(config.publicAppUrl, 'http://127.0.0.1:5173');
  }
  assert.throws(() => resolveEnvironment({ VITE_APP_ENV: 'emulator' }, { hostname: 'rostermax.vercel.app' }));
  assert.throws(() => resolveEnvironment({ VITE_APP_ENV: 'emulator', VITE_FIREBASE_PROJECT_ID: 'rostermax-60242' }));
});
test('preview requires isolated consistent project, namespace, origins and API', () => {
  assert.equal(resolveEnvironment(preview, { hostname: 'preview.example.test' }).projectId, 'rostermax-preview');
  for (const fields of [{ VITE_DATA_NAMESPACE: 'roster-max-production' }, { VITE_PUBLIC_APP_URL: 'https://rostermax.vercel.app' }, { VITE_CEO_API_URL: 'https://rostermax.vercel.app/api/ceo' }, { VITE_USE_EMULATORS: 'true' }]) assert.throws(() => resolveEnvironment({ ...preview, ...fields }));
  assert.throws(() => resolveEnvironment(preview, { hostname: 'unexpected.example.test' }));
});
test('production preserves the existing project and data namespace only when explicitly configured', () => {
  const config = resolveEnvironment({ ...preview, VITE_APP_ENV: 'production', VITE_DATA_NAMESPACE: 'roster-max-production', VITE_PUBLIC_APP_URL: 'https://rostermax.vercel.app', VITE_FIREBASE_PROJECT_ID: 'rostermax-60242', VITE_FIREBASE_AUTH_DOMAIN: 'rostermax-60242.firebaseapp.com', VITE_FIREBASE_STORAGE_BUCKET: 'rostermax-60242.firebasestorage.app' }, { hostname: 'rostermax.vercel.app' });
  assert.equal(config.projectId, 'rostermax-60242'); assert.equal(config.appId, 'roster-max-production');
});

test('deployment context prevents production settings being reused for Vercel previews', () => {
  assert.throws(() => resolveEnvironment({ ...preview, VITE_APP_ENV:'production', VERCEL_ENV:'preview' }), /Vercel Preview/);
  assert.throws(() => resolveEnvironment({ ...preview, VERCEL_ENV:'production' }), /production explícita/);
  assert.equal(resolveEnvironment({ ...preview, VERCEL_ENV:'preview' }).environment, 'preview');
});
