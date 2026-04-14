#!/usr/bin/env node

const admin = require('../functions/node_modules/firebase-admin');

const storeId = process.argv[2] || '2EeDEIDS1FO814KVfaaUVdv66bM2';
const productId = process.argv[3] || null;

function toPlain(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }

    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }

  return value;
}

async function run() {
  admin.initializeApp();
  const db = admin.firestore();

  const storePath = `stores/${storeId}`;
  const storeSnapshot = await db.doc(storePath).get();
  const store = storeSnapshot.exists ? storeSnapshot.data() : null;

  const productsQuerySnapshot = await db.collection('products').where('storeId', '==', storeId).get();
  const products = productsQuerySnapshot.docs.map((doc) => ({
    id: doc.id,
    path: doc.ref.path,
    data: toPlain(doc.data()),
  }));

  let requestedProduct = null;
  if (productId) {
    const requestedProductSnapshot = await db.doc(`products/${productId}`).get();
    const requestedProductData = requestedProductSnapshot.exists ? requestedProductSnapshot.data() : null;
    requestedProduct = {
      id: productId,
      exists: requestedProductSnapshot.exists,
      path: `products/${productId}`,
      matchesStoreId: Boolean(requestedProductData && requestedProductData.storeId === storeId),
      storeId: requestedProductData && typeof requestedProductData.storeId === 'string' ? requestedProductData.storeId : null,
      data: toPlain(requestedProductData),
    };
  }

  const result = {
    storeId,
    storePath,
    storeExists: storeSnapshot.exists,
    storeVerified: store ? store.verified === true : null,
    allowStore: Boolean(store && store.verified === true),
    productsCountForStore: products.length,
    productPathsForStore: products.map((item) => item.path),
    requestedProduct,
    store: toPlain(store),
    products,
  };

  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
