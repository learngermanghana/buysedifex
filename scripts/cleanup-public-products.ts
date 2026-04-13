import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

async function cleanupPublicProducts(dryRun = true) {
  const snapshot = await db.collection('publicProducts').limit(500).get();
  let count = 0;

  for (const doc of snapshot.docs) {
    count += 1;
    if (!dryRun) {
      await doc.ref.delete();
    }
  }

  console.log(`${dryRun ? 'Would delete' : 'Deleted'} ${count} publicProducts docs.`);
}

const dryRun = process.argv.includes('--apply') ? false : true;
cleanupPublicProducts(dryRun).catch((error) => {
  console.error(error);
  process.exit(1);
});
