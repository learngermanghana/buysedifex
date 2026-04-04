import { getApps, initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';

const readEnv = (...names: string[]): string | undefined => {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
};

const firebaseConfig = {
  apiKey: readEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'FIREBASE_API_KEY'),
  authDomain: readEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'),
  appId: readEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'FIREBASE_APP_ID'),
};

const missingFirebaseEnv = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseConfigError =
  missingFirebaseEnv.length > 0
    ? `Missing Firebase config (${missingFirebaseEnv.join(', ')}). Add NEXT_PUBLIC_FIREBASE_* from Firebase Web App config in Vercel, then redeploy.`
    : null;

let db: Firestore | null = null;

if (!firebaseConfigError) {
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
}

export { db };
