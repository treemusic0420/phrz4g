import { initializeApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const apiKey = firebaseConfig.apiKey || '';
console.info('[firebase] config debug', {
  apiKeyPresent: Boolean(apiKey),
  apiKeyPrefix: apiKey ? apiKey.slice(0, 6) : 'missing',
  projectId: firebaseConfig.projectId || 'missing',
  authDomain: firebaseConfig.authDomain || 'missing',
  storageBucket: firebaseConfig.storageBucket || 'missing',
});

const app = initializeApp(firebaseConfig);

const isCapacitor = Capacitor.isNativePlatform();
let authInstance;

if (isCapacitor) {
  try {
    authInstance = initializeAuth(app, {
      persistence: inMemoryPersistence,
    });
  } catch (error) {
    const isAlreadyInitializedError =
      error?.code === 'auth/already-initialized' ||
      String(error?.message ?? '').includes('already-initialized');

    if (isAlreadyInitializedError) {
      authInstance = getAuth(app);
    } else {
      throw error;
    }
  }
  console.info('[firebase] auth initialized for capacitor with inMemoryPersistence');
} else {
  authInstance = getAuth(app);
  console.info('[firebase] auth initialized for web');
}

export const auth = authInstance;
export const db = getFirestore(app);
export const storage = getStorage(app);
