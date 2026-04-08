import type { PublicProductDetail } from '@/lib/public-products';

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
};

type FirestoreRunQueryResponse = {
  document?: FirestoreDocument;
};

export type StoreProfile = {
  storeId: string;
  storeName: string;
  storeSlug?: string;
  storePhone?: string;
  storeLogoUrl?: string;
  storeBannerUrl?: string;
  city?: string;
  country?: string;
  addressLine1?: string;
  sameAs: string[];
  products: PublicProductDetail[];
};


export type CategoryProductPage = {
  products: PublicProductDetail[];
  hasMore: boolean;
};

type StoreEnrichedProduct = PublicProductDetail & {
  storeId?: string;
  storePhone?: string;
  storeSlug?: string;
  storeLogoUrl?: string;
  storeBannerUrl?: string;
  addressLine1?: string;
  sameAs: string[];
};

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY;

const readString = (fields: Record<string, FirestoreValue>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = fields[key];
    if (value && 'stringValue' in value) {
      const normalized = value.stringValue.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
  }

  return undefined;
};

const readNumber = (fields: Record<string, FirestoreValue>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = fields[key];
    if (value && 'doubleValue' in value && Number.isFinite(value.doubleValue)) {
      return value.doubleValue;
    }

    if (value && 'integerValue' in value) {
      const parsed = Number(value.integerValue);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
};

const readStringArray = (fields: Record<string, FirestoreValue>, key: string): string[] => {
  const value = fields[key];
  if (!value || !('arrayValue' in value) || !Array.isArray(value.arrayValue.values)) {
    return [];
  }

  return value.arrayValue.values
    .flatMap((item) => ('stringValue' in item ? [item.stringValue.trim()] : []))
    .filter((item) => item.length > 0);
};

const isValidHttpUrl = (input?: string): input is string => {
  if (!input) return false;

  try {
    const parsed = new URL(input);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const productFromDocument = (doc: FirestoreDocument): StoreEnrichedProduct => {
  const fields = doc.fields ?? {};
  const imageUrls = readStringArray(fields, 'imageUrls').filter(isValidHttpUrl);

  return {
    id: readString(fields, ['productId']) ?? doc.name?.split('/').at(-1) ?? '',
    productName: readString(fields, ['productName', 'name']) ?? 'Untitled item',
    description: readString(fields, ['description']) ?? '',
    imageUrls,
    price: readNumber(fields, ['price']),
    currency: readString(fields, ['currency']),
    storeName: readString(fields, ['storeName']) ?? 'Unknown store',
    categoryKey: readString(fields, ['categoryKey', 'category']),
    sku: readString(fields, ['sku']),
    stockCount: readNumber(fields, ['stockCount']),
    city: readString(fields, ['city', 'storeCity']),
    country: readString(fields, ['country', 'storeCountry']),
    waLink: readString(fields, ['waLink']),
    storeId: readString(fields, ['storeId']),
    storePhone: readString(fields, ['storePhone', 'phone', 'telephone']),
    storeSlug: readString(fields, ['storeSlug']),
    storeLogoUrl: readString(fields, ['storeLogoUrl', 'logoUrl']),
    storeBannerUrl: readString(fields, ['storeBannerUrl', 'bannerUrl']),
    addressLine1: readString(fields, ['addressLine1', 'address']),
    sameAs: [
      readString(fields, ['instagramUrl']),
      readString(fields, ['facebookUrl']),
      readString(fields, ['xUrl', 'twitterUrl']),
      readString(fields, ['tiktokUrl']),
      readString(fields, ['youtubeUrl']),
      readString(fields, ['websiteUrl']),
    ].filter(isValidHttpUrl),
  };
};

const toPublicProductDetail = (product: StoreEnrichedProduct): PublicProductDetail => ({
  id: product.id,
  storeId: product.storeId,
  productName: product.productName,
  description: product.description,
  imageUrls: product.imageUrls,
  price: product.price,
  currency: product.currency,
  storeName: product.storeName,
  categoryKey: product.categoryKey,
  sku: product.sku,
  stockCount: product.stockCount,
  city: product.city,
  country: product.country,
  waLink: product.waLink,
});

const runPublicProductsQuery = async (structuredQuery: Record<string, unknown>): Promise<FirestoreRunQueryResponse[]> => {
  if (!projectId) {
    return [];
  }

  const endpoint = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`);

  if (firebaseApiKey) {
    endpoint.searchParams.set('key', firebaseApiKey);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery }),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Failed to query publicProducts. Status: ${response.status}`);
  }

  return (await response.json()) as FirestoreRunQueryResponse[];
};

export const getStoreProfileById = async (storeId: string): Promise<StoreProfile | null> => {
  if (!storeId || !projectId) {
    return null;
  }

  const query = {
    select: {
      fields: [
        { fieldPath: 'productId' },
        { fieldPath: 'storeId' },
        { fieldPath: 'productName' },
        { fieldPath: 'name' },
        { fieldPath: 'description' },
        { fieldPath: 'imageUrls' },
        { fieldPath: 'price' },
        { fieldPath: 'currency' },
        { fieldPath: 'storeName' },
        { fieldPath: 'categoryKey' },
        { fieldPath: 'category' },
        { fieldPath: 'sku' },
        { fieldPath: 'stockCount' },
        { fieldPath: 'city' },
        { fieldPath: 'storeCity' },
        { fieldPath: 'country' },
        { fieldPath: 'storeCountry' },
        { fieldPath: 'waLink' },
        { fieldPath: 'storePhone' },
        { fieldPath: 'phone' },
        { fieldPath: 'telephone' },
        { fieldPath: 'storeSlug' },
        { fieldPath: 'storeLogoUrl' },
        { fieldPath: 'logoUrl' },
        { fieldPath: 'storeBannerUrl' },
        { fieldPath: 'bannerUrl' },
        { fieldPath: 'addressLine1' },
        { fieldPath: 'address' },
        { fieldPath: 'instagramUrl' },
        { fieldPath: 'facebookUrl' },
        { fieldPath: 'xUrl' },
        { fieldPath: 'twitterUrl' },
        { fieldPath: 'tiktokUrl' },
        { fieldPath: 'youtubeUrl' },
        { fieldPath: 'websiteUrl' },
        { fieldPath: 'publishedAt' },
      ],
    },
    from: [{ collectionId: 'publicProducts' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'storeId' },
              op: 'EQUAL',
              value: { stringValue: storeId },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: 'isVisible' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
    limit: 60,
  };

  const rows = await runPublicProductsQuery(query);
  const products = rows
    .flatMap((row) => (row.document ? [productFromDocument(row.document)] : []))
    .filter((item) => item.id && item.productName && item.imageUrls.length > 0);

  if (products.length === 0) {
    return null;
  }

  const head = products[0];
  const sameAs = Array.from(new Set(products.flatMap((item) => item.sameAs))).filter(isValidHttpUrl);

  return {
    storeId,
    storeName: head.storeName,
    storeSlug: head.storeSlug,
    storePhone: head.storePhone,
    storeLogoUrl: isValidHttpUrl(head.storeLogoUrl) ? head.storeLogoUrl : undefined,
    storeBannerUrl: isValidHttpUrl(head.storeBannerUrl) ? head.storeBannerUrl : undefined,
    city: head.city,
    country: head.country,
    addressLine1: head.addressLine1,
    sameAs,
    products: products.map(toPublicProductDetail),
  };
};

export const getProductsByCategory = async (
  categoryKey: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<CategoryProductPage> => {
  if (!categoryKey || !projectId) {
    return { products: [], hasMore: false };
  }

  const pageSize = Math.min(Math.max(options.pageSize ?? 24, 1), 48);
  const page = Math.max(options.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const query = {
    select: {
      fields: [
        { fieldPath: 'productId' },
        { fieldPath: 'storeId' },
        { fieldPath: 'productName' },
        { fieldPath: 'name' },
        { fieldPath: 'description' },
        { fieldPath: 'imageUrls' },
        { fieldPath: 'price' },
        { fieldPath: 'currency' },
        { fieldPath: 'storeName' },
        { fieldPath: 'categoryKey' },
        { fieldPath: 'category' },
        { fieldPath: 'sku' },
        { fieldPath: 'stockCount' },
        { fieldPath: 'city' },
        { fieldPath: 'storeCity' },
        { fieldPath: 'country' },
        { fieldPath: 'storeCountry' },
        { fieldPath: 'waLink' },
        { fieldPath: 'publishedAt' },
      ],
    },
    from: [{ collectionId: 'publicProducts' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'categoryKey' },
              op: 'EQUAL',
              value: { stringValue: categoryKey },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: 'isVisible' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
    offset,
    limit: pageSize + 1,
  };

  const rows = await runPublicProductsQuery(query);
  const items = rows
    .flatMap((row) => (row.document ? [productFromDocument(row.document)] : []))
    .map(toPublicProductDetail)
    .filter((item) => item.id && item.productName && item.imageUrls.length > 0);

  return {
    products: items.slice(0, pageSize),
    hasMore: items.length > pageSize,
  };
};

export const listPublicCategoryKeys = async (limitCount = 600): Promise<string[]> => {
  const query = {
    select: {
      fields: [{ fieldPath: 'categoryKey' }, { fieldPath: 'category' }, { fieldPath: 'publishedAt' }],
    },
    from: [{ collectionId: 'publicProducts' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'isVisible' },
        op: 'EQUAL',
        value: { booleanValue: true },
      },
    },
    orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
    limit: limitCount,
  };

  const rows = await runPublicProductsQuery(query);

  return Array.from(
    new Set(
      rows
        .flatMap((row) => (row.document ? [productFromDocument(row.document)] : []))
        .flatMap((product) => (product.categoryKey ? [product.categoryKey] : [])),
    ),
  ).sort();
};

export const listPublicStoreIds = async (limitCount = 200): Promise<string[]> => {
  const query = {
    select: {
      fields: [{ fieldPath: 'storeId' }, { fieldPath: 'publishedAt' }],
    },
    from: [{ collectionId: 'publicProducts' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'isVisible' },
        op: 'EQUAL',
        value: { booleanValue: true },
      },
    },
    orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
    limit: limitCount,
  };

  const rows = await runPublicProductsQuery(query);

  return Array.from(
    new Set(
      rows
        .flatMap((row) => (row.document ? [productFromDocument(row.document)] : []))
        .flatMap((product) => (product.storeId ? [product.storeId] : [])),
    ),
  );
};
