import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const fallbackConfig = {
  apiKey: 'AIzaSyC-YDie00IPgmhE4gOda8KiSjHTew595NA',
  authDomain: 'rostermax-60242.firebaseapp.com',
  projectId: 'rostermax-60242',
  storageBucket: 'rostermax-60242.firebasestorage.app',
  messagingSenderId: '937600149125',
  appId: '1:937600149125:web:7d610cdb6e22b8118e6bec',
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
};

export const APP_ID = 'roster-max-production';
export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
