import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from 'firebase/firestore';
import { resolveEnvironment } from './environment';

let environment;
let configurationError = '';
try { environment = resolveEnvironment(import.meta.env, { hostname: window.location.hostname }); }
catch (error) { configurationError = error.message; }
export { configurationError };
export const appEnvironment = environment;
export const APP_ID = environment?.appId;
// No Firebase SDK instance, and therefore no guest, exists on configuration error.
export const firebaseApp = environment ? initializeApp(environment.firebaseConfig) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
}) : null;
if (environment?.isEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9096', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8086);
}
