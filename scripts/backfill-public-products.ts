/**
 * Usage:
 *   ts-node scripts/backfill-public-products.ts --dry-run
 *   ts-node scripts/backfill-public-products.ts
 */

import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

type StoreDoc = {
  storeStatus?: string;
  eligibleForBuy?: boolean;
  buyOptOut?: boolean;
  name?: string;
  slug?: string;
  whatsappNumber?: string;
  logoUrl?: string;
  bannerUrl?: string;
  category?: string;
  updatedAt?: FirebaseFirestore.Timestamp;
};

type ProductDoc = {
  isActive?: boolean;
  isApproved?: boolean;
  category?: string;
  name?: string;
  slug?: string;
  description?: string;
  imageUrls?: string[];
  price?: number;
  currency?: string;
  featuredRank?: number;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

const dryRun = process.argv.includes('--dry-run');

function normalizeText(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeCategory(value?: string): string | null {
  const text = normalizeText(value);
  return text ? text.toLowerCase() : null;
}

function normalizeWhatsAppNumber(raw?: string): string | null {
  const normalized = (raw ?? '').replace(/[^\d]/g, '');
  return normalized || null;
}

function buildWhatsAppLink(store: StoreDoc, product: ProductDoc, storeId: string, productId: string): string | null {
  const phone = normalizeWhatsAppNumber(store.whatsappNumber);
  if (!phone) return null;

  const message = `Hi! I'm interested in ${normalizeText(product.name) ?? 'this product'} from ${normalizeText(store.name) ?? 'your store'}. (productId=${productId}, storeId=${storeId})`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function withDefaults(store: StoreDoc): StoreDoc {
  return {
    ...store,
    eligibleForBuy: store.eligibleForBuy ?? true,
    buyOptOut: store.buyOptOut ?? false,
  };
}

function visible(store: StoreDoc, product: ProductDoc): boolean {
  const storeVisible = store.storeStatus === 'active' && store.eligibleForBuy === true && store.buyOptOut === false;
  const productVisible = product.isActive === true && (product.isApproved === undefined || product.isApproved === true);
  return storeVisible && productVisible;
}

function publicId(storeId: string, productId: string): string {
  return `${storeId}_${productId}`;
}

function toPublicDoc(storeId: string, productId: string, store: StoreDoc, product: ProductDoc): Record<string, unknown> {
  return {
    id: publicId(storeId, productId),
    storeId,
    productId,
    isVisible: true,
    storeStatus: store.storeStatus ?? null,
    eligibleForBuy: store.eligibleForBuy === true,
    buyOptOut: store.buyOptOut === true,
    isActive: product.isActive === true,
    isApproved: product.isApproved ?? null,
    categoryKey: normalizeCategory(product.category ?? store.category),
    storeName: normalizeText(store.name),
    storeSlug: normalizeText(store.slug),
    storeLogoUrl: normalizeText(store.logoUrl),
    storeBannerUrl: normalizeText(store.bannerUrl),
    productName: normalizeText(product.name),
    productSlug: normalizeText(product.slug),
    description: normalizeText(product.description),
    imageUrls: Array.isArray(product.imageUrls) ? product.imageUrls.slice(0, 8) : [],
    price: typeof product.price === 'number' ? product.price : null,
    currency: normalizeText(product.currency) ?? 'USD',
    featuredRank: typeof product.featuredRank === 'number' ? product.featuredRank : 0,
    waLink: buildWhatsAppLink(store, product, storeId, productId),
    createdAt: product.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
    productUpdatedAt: product.updatedAt ?? null,
    storeUpdatedAt: store.updatedAt ?? null,
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function run(): Promise<void> {
  let storesProcessed = 0;
  let productsProcessed = 0;
  let writes = 0;
  let deletes = 0;

  const stores = await db.collection('stores').get();
  for (const storeDoc of stores.docs) {
    storesProcessed += 1;
    const storeId = storeDoc.id;
    const store = withDefaults(storeDoc.data() as StoreDoc);

    if (!dryRun && (storeDoc.data().eligibleForBuy === undefined || storeDoc.data().buyOptOut === undefined)) {
      await storeDoc.ref.set(
        {
          eligibleForBuy: store.eligibleForBuy,
          buyOptOut: store.buyOptOut,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      writes += 1;
    }

    const products = await db.collection(`stores/${storeId}/products`).get();
    const batch = db.batch();

    for (const productDoc of products.docs) {
      productsProcessed += 1;
      const productId = productDoc.id;
      const product = productDoc.data() as ProductDoc;
      const pubRef = db.collection('publicProducts').doc(publicId(storeId, productId));

      if (visible(store, product)) {
        batch.set(pubRef, toPublicDoc(storeId, productId, store, product), { merge: true });
        writes += 1;
      } else {
        batch.delete(pubRef);
        deletes += 1;
      }
    }

    if (!dryRun && !products.empty) {
      await batch.commit();
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        storesProcessed,
        productsProcessed,
        writes,
        deletes,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
