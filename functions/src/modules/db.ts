import * as admin from 'firebase-admin';

let db: admin.firestore.Firestore | null = null;

export function getDb(): admin.firestore.Firestore {
  if (!db) {
    db = admin.firestore();
  }
  return db;
}

export function __setDbForTests(testDb: admin.firestore.Firestore): void {
  db = testDb;
}
