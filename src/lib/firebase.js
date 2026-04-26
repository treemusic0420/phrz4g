import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyA_bx_qW6hpcOh4qR9e7qO8UdLmf5UEytg',
  authDomain: 'phrz4g.firebaseapp.com',
  projectId: 'phrz4g',
  storageBucket: 'phrz4g.firebasestorage.app',
  messagingSenderId: '795357705785',
  appId: '1:795357705785:web:ac2e7c8d717c41289bffe8',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
