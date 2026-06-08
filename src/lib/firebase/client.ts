import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore, enableIndexedDbPersistence, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getMessaging, type Messaging, getToken, deleteToken } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;
let messaging: Messaging | null = null;

export function getFirebaseApp() {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth() {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function getFirestoreDb() {
  if (!db) {
    db = initializeFirestore(getFirebaseApp(), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  }
  return db;
}

export function getFirebaseFunctions() {
  if (!functions) {
    functions = getFunctions(getFirebaseApp());
  }
  return functions;
}

export function getFirebaseMessaging() {
  if (!messaging && typeof window !== 'undefined') {
    const vapidKey = process.env.NEXT_PUBLIC_FCM_VAPID_KEY;
    if (vapidKey) {
      messaging = getMessaging(getFirebaseApp());
    }
  }
  return messaging;
}

export async function registerFCMToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  
  try {
    const { isSupported } = await import('firebase/messaging');
    const supported = await isSupported();
    if (!supported) return null;
    
    const msg = getMessaging(getFirebaseApp());
    const token = await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
    });
    return token;
  } catch (error) {
    console.error('[FCM] Token registration failed:', error);
    return null;
  }
}

export async function deleteFCMToken(): Promise<boolean> {
  const msg = getFirebaseMessaging();
  if (!msg) return false;
  
  try {
    const token = await getToken(msg, {
      vapidKey: process.env.NEXT_PUBLIC_FCM_VAPID_KEY,
    });
    if (token) {
      await deleteToken(msg);
    }
    return true;
  } catch (error) {
    console.error('[FCM] Token deletion failed:', error);
    return false;
  }
}

export function isFirestorePersistenceEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return (getFirestoreDb() as any)._settings?.persistenceEnabled ?? false;
}

export { firebaseConfig };