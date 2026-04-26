import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAObBuXIkEEDib1kDJP4bTwblpxGQ6w_Czo',
  authDomain: 'phrz4g.firebaseapp.com',
  projectId: 'phrz4g',
  storageBucket: 'phrz4g.firebasestorage.app',
  messagingSenderId: '795357705785',
  appId: '1:795357705785:web:ac2e7c8d717c41289bffe8',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
