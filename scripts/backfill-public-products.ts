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
  status?: string;
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
  storeId?: string;
  itemType?: string;
  category?: string;
  name?: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  price?: number;
  currency?: string;
  featuredRank?: number;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
  [key: string]: unknown;
};

type NormalizedProduct = ProductDoc & {
  storeId?: string;
  itemType?: string;
  category?: string;
  name?: string;
  slug?: string;
  description?: string;
  imageUrl?: string | null;
  imageUrls?: string[];
  price?: number;
  currency?: string;
  featuredRank?: number;
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

function readFirstString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length) return value.trim();
  }
  return undefined;
}

function readFirstNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function readFirstStringArray(source: Record<string, unknown>, keys: string[]): string[] | undefined {
  for (const key of keys) {
    const value = source[key];
    if (!Array.isArray(value)) continue;
    const normalized = value
      .map((entry) => normalizeText(typeof entry === 'string' ? entry : undefined))
      .filter((entry): entry is string => Boolean(entry));
    if (normalized.length) return normalized;
  }
  return undefined;
}

function normalizeProduct(product: ProductDoc): NormalizedProduct {
  const source = product as Record<string, unknown>;
  return {
    ...product,
    storeId: readFirstString(source, ['storeId', 'storeID', 'store_id', 'shopId', 'shop_id', 'merchantId', 'merchant_id']),
    itemType: readFirstString(source, ['itemType', 'item_type', 'type', 'kind']) ?? 'product',
    category: readFirstString(source, ['category', 'categoryKey', 'productCategory', 'department']),
    name: readFirstString(source, ['name', 'productName', 'product_name', 'title', 'itemName']),
    slug: readFirstString(source, ['slug', 'productSlug', 'product_slug']),
    description: readFirstString(source, ['description', 'desc', 'details', 'productDescription']),
    imageUrl: readFirstString(source, ['imageUrl', 'imageURL', 'image', 'photoUrl', 'thumbnailUrl']) ?? undefined,
    imageUrls: readFirstStringArray(source, ['imageUrls', 'imageURLs', 'images', 'gallery', 'photoUrls']) ?? product.imageUrls,
    price: readFirstNumber(source, ['price', 'productPrice', 'amount', 'unitPrice', 'sellingPrice', 'salePrice']),
    currency: readFirstString(source, ['currency', 'currencyCode', 'moneyCurrency']),
    featuredRank: readFirstNumber(source, ['featuredRank', 'featureRank', 'priority']),
  };
}

function buildWhatsAppLink(store: StoreDoc, product: NormalizedProduct, storeId: string, productId: string): string | null {
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

function getEffectiveStoreStatus(store: StoreDoc): string | null {
  return store.storeStatus ?? store.status ?? null;
}

function visible(store: StoreDoc, product: NormalizedProduct): boolean {
  const storeVisible = getEffectiveStoreStatus(store) === 'active' && store.eligibleForBuy === true && store.buyOptOut === false;

  const productVisible =
    product.itemType === 'product' &&
    typeof product.name === 'string' &&
    product.name.trim().length > 0 &&
    typeof product.price === 'number';

  return storeVisible && productVisible;
}

function publicId(storeId: string, productId: string): string {
  return `${storeId}_${productId}`;
}

function toPublicDoc(storeId: string, productId: string, store: StoreDoc, product: NormalizedProduct): Record<string, unknown> {
  return {
    id: publicId(storeId, productId),
    storeId,
    productId,
    isVisible: true,
    storeStatus: getEffectiveStoreStatus(store),
    eligibleForBuy: store.eligibleForBuy === true,
    buyOptOut: store.buyOptOut === true,
    categoryKey: normalizeCategory(product.category ?? store.category),
    storeName: normalizeText(store.name),
    storeSlug: normalizeText(store.slug),
    storeLogoUrl: normalizeText(store.logoUrl),
    storeBannerUrl: normalizeText(store.bannerUrl),
    productName: normalizeText(product.name),
    productSlug: normalizeText(product.slug),
    description: normalizeText(product.description),
    imageUrls:
      Array.isArray(product.imageUrls) && product.imageUrls.length
        ? product.imageUrls.slice(0, 8)
        : product.imageUrl
          ? [product.imageUrl]
          : [],
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
  const storesById = new Map<string, StoreDoc>();

  for (const storeDoc of stores.docs) {
    storesProcessed += 1;
    const storeId = storeDoc.id;
    const store = withDefaults(storeDoc.data() as StoreDoc);
    storesById.set(storeId, store);

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
  }

  const products = await db.collection('products').get();
  let batch = db.batch();
  let ops = 0;

  for (const productDoc of products.docs) {
    productsProcessed += 1;
    const productId = productDoc.id;
    const product = normalizeProduct(productDoc.data() as ProductDoc);
    const storeId = normalizeText(product.storeId);
    if (!storeId) continue;

    const store = storesById.get(storeId);
    if (!store) continue;

    const pubRef = db.collection('publicProducts').doc(publicId(storeId, productId));

    if (visible(store, product)) {
      batch.set(pubRef, toPublicDoc(storeId, productId, store, product), { merge: true });
      writes += 1;
    } else {
      batch.delete(pubRef);
      deletes += 1;
    }

    ops += 1;
    if (!dryRun && ops === 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (!dryRun && ops > 0) {
    await batch.commit();
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
