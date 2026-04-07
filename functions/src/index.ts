import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

admin.initializeApp();

const db = admin.firestore();

const STORE_PATH = 'stores/{storeId}';
const PRODUCT_PATH = 'stores/{storeId}/products/{productId}';
const FLAT_PRODUCT_PATH = 'products/{productId}';
const PUBLIC_PRODUCTS_COLLECTION = 'publicProducts';

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
  updatedAt?: FirebaseFirestore.Timestamp;
};

type ProductDoc = {
  storeId?: string;
  name?: string;
  slug?: string;
  description?: string;
  category?: string;
  imageUrls?: string[];
  price?: number;
  currency?: string;
  isActive?: boolean;
  isApproved?: boolean;
  featuredRank?: number;
  updatedAt?: FirebaseFirestore.Timestamp;
  createdAt?: FirebaseFirestore.Timestamp;
};

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
  if (!normalized) return null;
  return normalized;
}

function buildWhatsAppLink(input: {
  phone?: string;
  storeName?: string;
  productName?: string;
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

function isStoreVisibleOnBuy(store: StoreDoc): boolean {
  return (
    store.storeStatus === 'active' &&
    store.eligibleForBuy === true &&
    store.buyOptOut === false
  );
}

function isProductVisibleOnBuy(product: ProductDoc): boolean {
  // Optional approval gate: when isApproved exists it must be true.
  const approvedGate = product.isApproved === undefined || product.isApproved === true;
  return product.isActive === true && approvedGate;
}

function computeVisibility(store: StoreDoc, product: ProductDoc): boolean {
  // Temporary permissive mode:
  // publish all store products, and let frontend approval be controlled
  // only by approvedStores collection membership.
  return true;
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

  return {
    // Identity
    id: publicProductId(storeId, productId),
    storeId,
    productId,

    // Visibility + filters
    isVisible: true,
    storeStatus: store.storeStatus ?? null,
    eligibleForBuy: store.eligibleForBuy === true,
    buyOptOut: store.buyOptOut === true,
    isActive: product.isActive === true,
    isApproved: product.isApproved ?? null,
    categoryKey,

    // Store (public subset only)
    storeName,
    storeSlug: normalizeText(store.slug),
    storeLogoUrl: normalizeText(store.logoUrl),
    storeBannerUrl: normalizeText(store.bannerUrl),

    // Product (public subset only)
    productName,
    productSlug: normalizeText(product.slug),
    description: normalizeText(product.description),
    imageUrls: Array.isArray(product.imageUrls) ? product.imageUrls.slice(0, 8) : [],
    price: typeof product.price === 'number' ? product.price : null,
    currency: normalizeText(product.currency) ?? 'USD',
    featuredRank: typeof product.featuredRank === 'number' ? product.featuredRank : 0,

    // CTA
    waLink: buildWhatsAppLink({
      phone: store.whatsappNumber,
      storeName: storeName ?? undefined,
      productName: productName ?? undefined,
      productId,
      storeId,
    }),

    // Ranking & metadata
    createdAt: product.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
    productUpdatedAt: product.updatedAt ?? null,
    storeUpdatedAt: store.updatedAt ?? null,
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function withStoreDefaults(store: StoreDoc): StoreDoc {
  return {
    ...store,
    eligibleForBuy: store.eligibleForBuy ?? true,
    buyOptOut: store.buyOptOut ?? false,
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
  const productsRef = db.collection(`stores/${storeId}/products`);

  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  const pageSize = 250;

  while (true) {
    let query: FirebaseFirestore.Query = productsRef.orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (lastDoc) query = query.startAfter(lastDoc);

    const page = await query.get();
    if (page.empty) break;

    const batch = db.batch();

    for (const productDoc of page.docs) {
      const product = productDoc.data() as ProductDoc;
      const pubRef = db.collection(PUBLIC_PRODUCTS_COLLECTION).doc(publicProductId(storeId, productDoc.id));
      const visible = computeVisibility(store, product);

      if (!visible) {
        batch.delete(pubRef);
      } else {
        batch.set(pubRef, toPublicProductDoc({ storeId, productId: productDoc.id, store, product }), { merge: true });
      }
    }

    await batch.commit();
    lastDoc = page.docs[page.docs.length - 1];

    if (page.size < pageSize) break;
  }

  logger.info('Rebuild completed', { storeId });
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

  // Normalize defaults if they were missing previously.
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
    before.bannerUrl !== after.bannerUrl;

  if (visibilityInputsChanged) {
    await rebuildPublicProductsForStore(storeId);
  }
});

export const onProductCreatedOrUpdated = onDocumentUpdated(PRODUCT_PATH, async (event) => {
  if (!event.data) return;

  const { storeId, productId } = event.params;
  const storeSnap = await db.collection('stores').doc(storeId).get();
  if (!storeSnap.exists) return;

  const store = withStoreDefaults(storeSnap.data() as StoreDoc);
  const product = event.data.after.data() as ProductDoc;

  await upsertOrDeletePublicProduct({ storeId, productId, store, product });
});

export const onProductCreated = onDocumentCreated(PRODUCT_PATH, async (event) => {
  if (!event.data) return;

  const { storeId, productId } = event.params;
  const storeSnap = await db.collection('stores').doc(storeId).get();
  if (!storeSnap.exists) return;

  const store = withStoreDefaults(storeSnap.data() as StoreDoc);
  const product = event.data.data() as ProductDoc;

  await upsertOrDeletePublicProduct({ storeId, productId, store, product });
});

export const onProductDeleted = onDocumentDeleted(PRODUCT_PATH, async (event) => {
  const { storeId, productId } = event.params;
  await db.collection(PUBLIC_PRODUCTS_COLLECTION).doc(publicProductId(storeId, productId)).delete().catch(() => undefined);
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
  await upsertOrDeletePublicProduct({ storeId: afterStoreId, productId, store, product: after });
}

export const onFlatProductCreated = onDocumentCreated(FLAT_PRODUCT_PATH, async (event) => {
  if (!event.data) return;
  await syncFlatProduct({ productId: event.params.productId, after: event.data.data() as ProductDoc });
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
  await syncFlatProduct({ productId: event.params.productId, before: event.data.data() as ProductDoc });
});
