import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB4m1IbmKDiGI48U3Hd1W7I1bVz7T4cIx0',
  authDomain: 'axiora-fx-hendfirmsh.firebaseapp.com',
  projectId: 'axiora-fx-hendfirmsh',
  storageBucket: 'axiora-fx-hendfirmsh.firebasestorage.app',
  messagingSenderId: '160510298004',
  appId: '1:160510298004:web:d6b06ae46f31b18451f181',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
