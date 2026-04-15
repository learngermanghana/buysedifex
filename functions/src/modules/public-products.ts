import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { getDb } from './db';
import { normalizeCategory, normalizeProduct, normalizeStore, normalizeText } from './normalization';
import { computeRankingScore } from './ranking';
import { buildWhatsAppLink, computeVisibility, getEffectiveStoreStatus, publicProductId, resolveStorePhone, withStoreDefaults } from './visibility';
import { type ProductDoc, type StoreDoc } from './types';

export const PUBLIC_PRODUCTS_COLLECTION = 'publicProducts';

export function toPublicProductDoc(input: {
  storeId: string;
  productId: string;
  store: StoreDoc;
  product: ProductDoc;
}): Record<string, unknown> {
  const { storeId, productId } = input;
  const store = normalizeStore(input.store);
  const product = normalizeProduct(input.product);

  const storeName = normalizeText(store.name);
  const productName = normalizeText(product.name);
  const categoryKey = normalizeCategory(product.category ?? store.category);
  const rankingScore = computeRankingScore(store, product);

  const normalizedImageUrls = Array.isArray(product.imageUrls)
    ? product.imageUrls.map((url) => normalizeText(url)).filter((url): url is string => Boolean(url))
    : [];

  const fallbackImageUrl = normalizeText(product.imageUrl);
  const imageUrls = normalizedImageUrls.length ? normalizedImageUrls.slice(0, 8) : fallbackImageUrl ? [fallbackImageUrl] : [];

  return {
    id: publicProductId(storeId, productId),
    storeId,
    productId,
    isVisible: true,
    storeStatus: getEffectiveStoreStatus(store),
    eligibleForBuy: store.eligibleForBuy === true,
    buyOptOut: store.buyOptOut === true,
    verified: store.verified === true,
    categoryKey,
    storeName,
    storeSlug: normalizeText(store.slug),
    storePhone: resolveStorePhone(store),
    storeLogoUrl: normalizeText(store.logoUrl),
    storeBannerUrl: normalizeText(store.bannerUrl),
    city: normalizeText(store.city),
    country: normalizeText(store.country),
    addressLine1: normalizeText(store.addressLine1),
    productName,
    productSlug: normalizeText(product.slug),
    description: normalizeText(product.description),
    imageUrls,
    imageAlt: normalizeText(product.imageAlt),
    price: typeof product.price === 'number' ? product.price : null,
    currency: normalizeText(product.currency) ?? 'GHS',
    featuredRank: typeof product.featuredRank === 'number' ? product.featuredRank : 0,
    rankingScore,
    itemType: normalizeText(product.itemType),
    shopLink: normalizeText(product.shopLink),
    sku: normalizeText(product.sku),
    barcode: normalizeText(product.barcode),
    taxRate: typeof product.taxRate === 'number' ? product.taxRate : null,
    reorderPoint: typeof product.reorderPoint === 'number' ? product.reorderPoint : null,
    stockCount: typeof product.stockCount === 'number' ? product.stockCount : null,
    expiryDate: product.expiryDate ?? null,
    batchNumber: normalizeText(product.batchNumber),
    manufacturerName: normalizeText(product.manufacturerName),
    productionDate: product.productionDate ?? null,
    showOnReceipt: product.showOnReceipt === true,
    waLink: buildWhatsAppLink({
      phone: resolveStorePhone(store),
      storeName,
      productName,
      productId,
      storeId,
    }),
    createdAt: product.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
    productUpdatedAt: product.updatedAt ?? null,
    storeUpdatedAt: store.updatedAt ?? null,
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function safeDeletePublicProduct(storeId: string, productId: string, reason: string): Promise<void> {
  const db = getDb();
  try {
    await db.collection(PUBLIC_PRODUCTS_COLLECTION).doc(publicProductId(storeId, productId)).delete();
  } catch (error) {
    logger.error('Failed to delete public product document', { storeId, productId, reason, error });
  }
}

export async function upsertOrDeletePublicProduct(params: {
  storeId: string;
  productId: string;
  store: StoreDoc;
  product: ProductDoc;
}): Promise<void> {
  const db = getDb();
  const { storeId, productId, store } = params;
  const product = normalizeProduct(params.product);
  const visible = computeVisibility(store, product);
  const ref = db.collection(PUBLIC_PRODUCTS_COLLECTION).doc(publicProductId(storeId, productId));

  if (!visible) {
    await safeDeletePublicProduct(storeId, productId, 'not-visible');
    return;
  }

  await ref.set(toPublicProductDoc({ storeId, productId, store, product }), { merge: true });
}

export async function rebuildPublicProductsForStore(storeId: string): Promise<void> {
  const db = getDb();
  const storeSnap = await db.collection('stores').doc(storeId).get();
  if (!storeSnap.exists) {
    logger.warn('Store missing; skipping rebuild', { storeId });
    return;
  }

  const store = withStoreDefaults(storeSnap.data() as StoreDoc);
  const productsSnap = await db.collection('products').where('storeId', '==', storeId).get();

  if (productsSnap.empty) {
    logger.info('No flat products found for store', { storeId });
    return;
  }

  let batch = db.batch();
  let ops = 0;

  for (const productDoc of productsSnap.docs) {
    const product = normalizeProduct(productDoc.data() as ProductDoc);
    const pubRef = db.collection(PUBLIC_PRODUCTS_COLLECTION).doc(publicProductId(storeId, productDoc.id));
    const visible = computeVisibility(store, product);

    if (!visible) {
      batch.delete(pubRef);
    } else {
      batch.set(pubRef, toPublicProductDoc({ storeId, productId: productDoc.id, store, product }), { merge: true });
    }

    ops += 1;
    if (ops === 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  logger.info('Rebuild completed', { storeId, productsProcessed: productsSnap.size });
}

export async function syncFlatProduct(params: {
  productId: string;
  after?: ProductDoc;
  before?: ProductDoc;
}): Promise<void> {
  const db = getDb();
  const { productId, after, before } = params;
  const normalizedAfter = after ? normalizeProduct(after) : undefined;
  const normalizedBefore = before ? normalizeProduct(before) : undefined;
  const afterStoreId = normalizeText(normalizedAfter?.storeId);
  const beforeStoreId = normalizeText(normalizedBefore?.storeId);

  if (beforeStoreId && beforeStoreId !== afterStoreId) {
    await safeDeletePublicProduct(beforeStoreId, productId, 'store-changed');
  }

  if (!normalizedAfter || !afterStoreId) {
    if (beforeStoreId) {
      await safeDeletePublicProduct(beforeStoreId, productId, 'product-deleted-or-missing-storeId');
    } else {
      logger.warn('Flat product missing storeId; skipping sync', { productId });
    }
    return;
  }

  const storeSnap = await db.collection('stores').doc(afterStoreId).get();
  if (!storeSnap.exists) {
    logger.warn('Store missing for flat product; skipping sync', { productId, storeId: afterStoreId });
    return;
  }

  await upsertOrDeletePublicProduct({
    storeId: afterStoreId,
    productId,
    store: withStoreDefaults(storeSnap.data() as StoreDoc),
    product: normalizedAfter,
  });
}
