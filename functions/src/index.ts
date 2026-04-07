import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

admin.initializeApp();

const db = admin.firestore();

const STORE_PATH = 'stores/{storeId}';
const FLAT_PRODUCT_PATH = 'products/{productId}';
const PUBLIC_PRODUCTS_COLLECTION = 'publicProducts';

// NOTE: Nested store product triggers are intentionally not used.
// Only flat products/{productId} triggers should manage publicProducts sync.

type StoreDoc = {
  name?: string;
  slug?: string;
  storeStatus?: string;
  eligibleForBuy?: boolean;
  buyOptOut?: boolean;
  whatsappNumber?: string;
  logoUrl?: string;
  bannerUrl?: string;
  category?: string;
  updatedAt?: admin.firestore.Timestamp;
};

type ProductDoc = {
  storeId?: string;
  itemType?: string;
  category?: string;
  name?: string;
  slug?: string;
  description?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageUrls?: string[];
  price?: number;
  currency?: string;
  sku?: string | null;
  barcode?: string | null;
  taxRate?: number | null;
  reorderPoint?: number | null;
  stockCount?: number | null;
  expiryDate?: admin.firestore.Timestamp | null;
  batchNumber?: string | null;
  manufacturerName?: string | null;
  productionDate?: admin.firestore.Timestamp | null;
  showOnReceipt?: boolean;
  featuredRank?: number;
  updatedAt?: admin.firestore.Timestamp;
  createdAt?: admin.firestore.Timestamp;
};

function normalizeText(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeCategory(value?: string | null): string | null {
  const text = normalizeText(value);
  return text ? text.toLowerCase() : null;
}

function normalizeWhatsAppNumber(raw?: string | null): string | null {
  const normalized = (raw ?? '').replace(/[^\d]/g, '');
  return normalized || null;
}

function buildWhatsAppLink(input: {
  phone?: string | null;
  storeName?: string | null;
  productName?: string | null;
  productId: string;
  storeId: string;
}): string | null {
  const phone = normalizeWhatsAppNumber(input.phone);
  if (!phone) return null;

  const productLabel = normalizeText(input.productName) ?? 'this product';
  const storeLabel = normalizeText(input.storeName) ?? 'your store';
  const message = `Hi! I'm interested in ${productLabel} from ${storeLabel}. (productId=${input.productId}, storeId=${input.storeId})`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function withStoreDefaults(store: StoreDoc): StoreDoc {
  return {
    ...store,
    eligibleForBuy: store.eligibleForBuy ?? true,
    buyOptOut: store.buyOptOut ?? false,
  };
}

function isStoreBuyVisible(store: StoreDoc): boolean {
  return store.storeStatus === 'active' && store.eligibleForBuy === true && store.buyOptOut === false;
}

function isVisibleProduct(product: ProductDoc): boolean {
  return (
    product.itemType === 'product' &&
    typeof product.name === 'string' &&
    product.name.trim().length > 0 &&
    typeof product.price === 'number'
  );
}

function computeVisibility(store: StoreDoc, product: ProductDoc): boolean {
  return isStoreBuyVisible(store) && isVisibleProduct(product);
}

function publicProductId(storeId: string, productId: string): string {
  return `${storeId}_${productId}`;
}

function toPublicProductDoc(input: {
  storeId: string;
  productId: string;
  store: StoreDoc;
  product: ProductDoc;
}): Record<string, unknown> {
  const { storeId, productId, store, product } = input;

  const storeName = normalizeText(store.name);
  const productName = normalizeText(product.name);
  const categoryKey = normalizeCategory(product.category ?? store.category);

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
    storeStatus: store.storeStatus ?? null,
    eligibleForBuy: store.eligibleForBuy === true,
    buyOptOut: store.buyOptOut === true,
    categoryKey,

    storeName,
    storeSlug: normalizeText(store.slug),
    storeLogoUrl: normalizeText(store.logoUrl),
    storeBannerUrl: normalizeText(store.bannerUrl),

    productName,
    productSlug: normalizeText(product.slug),
    description: normalizeText(product.description),
    imageUrls,
    imageAlt: normalizeText(product.imageAlt),
    price: typeof product.price === 'number' ? product.price : null,
    currency: normalizeText(product.currency) ?? 'USD',
    featuredRank: typeof product.featuredRank === 'number' ? product.featuredRank : 0,

    itemType: normalizeText(product.itemType),
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
      phone: store.whatsappNumber,
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

async function upsertOrDeletePublicProduct(params: {
  storeId: string;
  productId: string;
  store: StoreDoc;
  product: ProductDoc;
}): Promise<void> {
  const { storeId, productId, store, product } = params;
  const visible = computeVisibility(store, product);
  const ref = db.collection(PUBLIC_PRODUCTS_COLLECTION).doc(publicProductId(storeId, productId));

  if (!visible) {
    await ref.delete().catch(() => undefined);
    return;
  }

  await ref.set(toPublicProductDoc({ storeId, productId, store, product }), { merge: true });
}

export async function rebuildPublicProductsForStore(storeId: string): Promise<void> {
  const storeSnap = await db.collection('stores').doc(storeId).get();
  if (!storeSnap.exists) {
    logger.warn('Store missing; skipping rebuild', { storeId });
    return;
  }

  const store = withStoreDefaults(storeSnap.data() as StoreDoc);

  const productsSnap = await db
    .collection('products')
    .where('storeId', '==', storeId)
    .get();

  if (productsSnap.empty) {
    logger.info('No flat products found for store', { storeId });
    return;
  }

  let batch = db.batch();
  let ops = 0;

  for (const productDoc of productsSnap.docs) {
    const product = productDoc.data() as ProductDoc;
    const pubRef = db.collection(PUBLIC_PRODUCTS_COLLECTION).doc(publicProductId(storeId, productDoc.id));
    const visible = computeVisibility(store, product);

    if (!visible) {
      batch.delete(pubRef);
    } else {
      batch.set(
        pubRef,
        toPublicProductDoc({
          storeId,
          productId: productDoc.id,
          store,
          product,
        }),
        { merge: true },
      );
    }

    ops += 1;

    if (ops === 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  logger.info('Rebuild completed', { storeId, productsProcessed: productsSnap.size });
}

export const onStoreCreated = onDocumentCreated(STORE_PATH, async (event) => {
  if (!event.data) return;

  const storeId = event.params.storeId;
  const created = event.data.data() as StoreDoc;
  const defaults = withStoreDefaults(created);

  await event.data.ref.set(
    {
      eligibleForBuy: defaults.eligibleForBuy,
      buyOptOut: defaults.buyOptOut,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await rebuildPublicProductsForStore(storeId);
});

export const onStoreUpdated = onDocumentUpdated(STORE_PATH, async (event) => {
  if (!event.data) return;

  const storeId = event.params.storeId;
  const after = withStoreDefaults(event.data.after.data() as StoreDoc);
  const before = withStoreDefaults(event.data.before.data() as StoreDoc);

  if (event.data.after.data()?.eligibleForBuy === undefined || event.data.after.data()?.buyOptOut === undefined) {
    await event.data.after.ref.set(
      {
        eligibleForBuy: after.eligibleForBuy,
        buyOptOut: after.buyOptOut,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  const visibilityInputsChanged =
    before.storeStatus !== after.storeStatus ||
    before.eligibleForBuy !== after.eligibleForBuy ||
    before.buyOptOut !== after.buyOptOut ||
    before.whatsappNumber !== after.whatsappNumber ||
    before.name !== after.name ||
    before.slug !== after.slug ||
    before.logoUrl !== after.logoUrl ||
    before.bannerUrl !== after.bannerUrl ||
    before.category !== after.category;

  if (visibilityInputsChanged) {
    await rebuildPublicProductsForStore(storeId);
  }
});

async function syncFlatProduct(params: {
  productId: string;
  after?: ProductDoc;
  before?: ProductDoc;
}): Promise<void> {
  const { productId, after, before } = params;
  const afterStoreId = normalizeText(after?.storeId);
  const beforeStoreId = normalizeText(before?.storeId);

  if (beforeStoreId && beforeStoreId !== afterStoreId) {
    await db
      .collection(PUBLIC_PRODUCTS_COLLECTION)
      .doc(publicProductId(beforeStoreId, productId))
      .delete()
      .catch(() => undefined);
  }

  if (!after || !afterStoreId) {
    if (beforeStoreId) {
      await db
        .collection(PUBLIC_PRODUCTS_COLLECTION)
        .doc(publicProductId(beforeStoreId, productId))
        .delete()
        .catch(() => undefined);
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

  const store = withStoreDefaults(storeSnap.data() as StoreDoc);
  await upsertOrDeletePublicProduct({
    storeId: afterStoreId,
    productId,
    store,
    product: after,
  });
}

export const onFlatProductCreated = onDocumentCreated(FLAT_PRODUCT_PATH, async (event) => {
  if (!event.data) return;
  await syncFlatProduct({
    productId: event.params.productId,
    after: event.data.data() as ProductDoc,
  });
});

export const onFlatProductUpdated = onDocumentUpdated(FLAT_PRODUCT_PATH, async (event) => {
  if (!event.data) return;
  await syncFlatProduct({
    productId: event.params.productId,
    before: event.data.before.data() as ProductDoc,
    after: event.data.after.data() as ProductDoc,
  });
});

export const onFlatProductDeleted = onDocumentDeleted(FLAT_PRODUCT_PATH, async (event) => {
  if (!event.data) return;
  await syncFlatProduct({
    productId: event.params.productId,
    before: event.data.data() as ProductDoc,
  });
});
