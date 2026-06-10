import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminMessaging: Messaging;

function getServiceAccount() {
  // Check both env var names for compatibility
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FCM_SERVER_KEY;
  if (json) {
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error('[Firebase Admin] Invalid service account JSON:', e);
    }
  }
  console.warn('[Firebase Admin] No service account configured (checked FIREBASE_SERVICE_ACCOUNT_JSON and FCM_SERVER_KEY)');
  return null;
}

export function getAdminApp() {
  if (!adminApp) {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) {
      console.warn('[Firebase Admin] No service account configured - admin features will be unavailable');
      return null as any;
    }
    adminApp = getApps().length ? getApps()[0] : initializeApp({
      credential: cert(serviceAccount),
    });
  }
  return adminApp;
}

// Lazy getters that check if app exists
function getAdminAppSafe() {
  const app = getAdminApp();
  if (!app) return null;
  return app;
}

export function getAdminAuth() {
  const app = getAdminAppSafe();
  if (!app) return null as any;
  if (!adminAuth) {
    adminAuth = getAuth(app);
  }
  return adminAuth;
}

export function getAdminDb() {
  const app = getAdminAppSafe();
  if (!app) return null as any;
  if (!adminDb) {
    adminDb = getFirestore(app);
  }
  return adminDb;
}

export function getAdminMessaging() {
  const app = getAdminAppSafe();
  if (!app) return null as any;
  if (!adminMessaging) {
    adminMessaging = getMessaging(app);
  }
  return adminMessaging;
}

export function verifyIdToken(token: string) {
  const auth = getAdminAuth();
  if (!auth) throw new Error('Firebase Admin not initialized');
  return auth.verifyIdToken(token);
}

export function createCustomToken(uid: string, claims?: Record<string, any>) {
  const auth = getAdminAuth();
  if (!auth) throw new Error('Firebase Admin not initialized');
  return auth.createCustomToken(uid, claims);
}