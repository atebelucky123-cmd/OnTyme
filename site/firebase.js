// Firebase app initialization, shared across every page.
// NOTE: this apiKey is not a secret — Firebase web config is meant to be public.
// Access control is enforced by Firestore/Storage security rules, not by hiding this file.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDVvOzgPYyq2ZFeQEcnTU-HNa9WS5wuSHo",
  authDomain: "ontyme-v01.firebaseapp.com",
  projectId: "ontyme-v01",
  storageBucket: "ontyme-v01.firebasestorage.app",
  messagingSenderId: "913834336422",
  appId: "1:913834336422:web:6f782a6e892dcce3a8d467"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp
};
