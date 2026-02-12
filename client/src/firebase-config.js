// client/src/firebase-config.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "***REMOVIDO***",
  authDomain: "sistema-reserva-salas-77c75.firebaseapp.com",
  projectId: "sistema-reserva-salas-77c75",
  storageBucket: "sistema-reserva-salas-77c75.firebasestorage.app",
  messagingSenderId: "517086462153",
  appId: "1:517086462153:web:5bbc1f2a5bec8ca5044d18"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();