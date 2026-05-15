import { getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

const firstDefined = (...values: Array<string | undefined>): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const firebaseConfig = {
  apiKey: firstDefined(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, process.env.FIREBASE_API_KEY),
  authDomain: firstDefined(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, process.env.FIREBASE_AUTH_DOMAIN),
  projectId: firstDefined(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, process.env.FIREBASE_PROJECT_ID),
  appId: firstDefined(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, process.env.FIREBASE_APP_ID),
};

const missingFirebaseEnv = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseConfigError =
  missingFirebaseEnv.length > 0
    ? `Missing Firebase config (${missingFirebaseEnv.join(', ')}). Add NEXT_PUBLIC_FIREBASE_* from Firebase Web App config in Vercel, then redeploy.`
    : null;

let db: Firestore | null = null;
let auth: Auth | null = null;
let firebaseAppInitialized = false;

if (!firebaseConfigError) {
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
  firebaseAppInitialized = true;
}

export const getFirebaseAuth = (): Auth | null => {
  if (!firebaseAppInitialized) return null;
  if (auth) return auth;
  const app = getApps()[0];
  auth = getAuth(app);
  return auth;
};

export { db, auth };
