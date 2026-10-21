import { initializeApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';

interface FirebaseConfigStatus {
  isConfigured: boolean;
  missingKeys: string[];
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function checkFirebaseConfig(): FirebaseConfigStatus {
  const missingKeys: string[] = [];
  if (!firebaseConfig.apiKey) missingKeys.push('VITE_FIREBASE_API_KEY');
  if (!firebaseConfig.projectId) missingKeys.push('VITE_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.appId) missingKeys.push('VITE_FIREBASE_APP_ID');

  return {
    isConfigured: missingKeys.length === 0,
    missingKeys,
  };
}

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

const status = checkFirebaseConfig();

if (status.isConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    auth = getAuth(app);
    console.info('[Firebase] Cloud Firestore & Auth initialized on Spark free tier.');
  } catch (err) {
    console.warn('[Firebase] Initialization error:', err);
    app = null;
    db = null;
    auth = null;
  }
} else {
  console.info(
    `[Firebase] Optional cloud sync not configured: [${status.missingKeys.join(', ')}]. Operating in IndexedDB local mode.`
  );
}

// Authentication Helpers for Phone/Laptop Sync
export async function ensureAuthenticated(): Promise<User | null> {
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;

  try {
    // Attempt anonymous authentication by default for zero-friction sync
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.warn('[Firebase] Anonymous sign-in attempt:', err);
    return null;
  }
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return cred.user;
}

export async function registerWithEmail(email: string, pass: string): Promise<User> {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  return cred.user;
}

export async function logoutUser(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export { app, db, auth };
