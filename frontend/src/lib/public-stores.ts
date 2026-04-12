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
  websiteUrl?: string;
  storeLogoUrl?: string;
  storeBannerUrl?: string;
  city?: string;
  country?: string;
  addressLine1?: string;
  sameAs: string[];
  products: PublicProductDetail[];
  verified: boolean;
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
  storeWebsiteUrl?: string;
  addressLine1?: string;
  sameAs: string[];
  verified?: boolean;
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

const readBoolean = (fields: Record<string, FirestoreValue>, keys: string[]): boolean | undefined => {
  for (const key of keys) {
    const value = fields[key];
    if (value && 'booleanValue' in value) {
      return value.booleanValue;
    }
  }

  return undefined;
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
    city: readString(fields, ['city', 'storeCity', 'town']),
    country: readString(fields, ['country', 'storeCountry']),
    waLink: readString(fields, ['waLink']),
    storeId: readString(fields, ['storeId']),
    storePhone: readString(fields, ['storePhone', 'phone', 'telephone', 'whatsappNumber']),
    storeSlug: readString(fields, ['storeSlug']),
    storeLogoUrl: readString(fields, ['storeLogoUrl', 'logoUrl']),
    storeBannerUrl: readString(fields, ['storeBannerUrl', 'bannerUrl']),
    storeWebsiteUrl: readString(fields, ['websiteUrl', 'storeWebsite', 'website']),
    addressLine1: readString(fields, ['addressLine1', 'address']),
    verified: readBoolean(fields, ['verified']),
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
  verified: product.verified,
});

const normalizeStoreNamesByStoreId = (products: StoreEnrichedProduct[]): StoreEnrichedProduct[] => {
  const canonicalNamesByStoreId = new Map<string, string>();

  products.forEach((product) => {
    const storeId = product.storeId?.trim();
    const storeName = product.storeName?.trim();
    if (!storeId || !storeName) return;
    if (!canonicalNamesByStoreId.has(storeId)) {
      canonicalNamesByStoreId.set(storeId, storeName);
    }
  });

  return products.map((product) => {
    const storeId = product.storeId?.trim();
    if (!storeId) return product;

    const canonicalStoreName = canonicalNamesByStoreId.get(storeId);
    if (!canonicalStoreName || canonicalStoreName === product.storeName) return product;
    return { ...product, storeName: canonicalStoreName };
  });
};

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
    let details = '';
    try {
      const errorBody = (await response.json()) as { error?: { message?: string; status?: string } };
      const message = errorBody?.error?.message?.trim();
      const status = errorBody?.error?.status?.trim();
      details = [status, message].filter(Boolean).join(': ');
    } catch {
      details = '';
    }

    const suffix = details ? ` (${details})` : '';
    throw new Error(`Failed to query publicProducts. Status: ${response.status}${suffix}`);
  }

  return (await response.json()) as FirestoreRunQueryResponse[];
};

export const getStoreProfileById = async (storeId: string): Promise<StoreProfile | null> => {
  if (!storeId || !projectId) {
    return null;
  }

  const buildStoreQuery = (fieldPath: 'storeId' | 'storeSlug' | 'storeName', value: string) => ({
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
        { fieldPath: 'town' },
        { fieldPath: 'country' },
        { fieldPath: 'storeCountry' },
        { fieldPath: 'waLink' },
        { fieldPath: 'storePhone' },
        { fieldPath: 'phone' },
        { fieldPath: 'telephone' },
        { fieldPath: 'whatsappNumber' },
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
        { fieldPath: 'verified' },
      ],
    },
    from: [{ collectionId: 'publicProducts' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath },
              op: 'EQUAL',
              value: { stringValue: value },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: 'isVisible' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: 'verified' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
    limit: 60,
  });

  const fallbackLookups: Array<{ fieldPath: 'storeId' | 'storeSlug' | 'storeName'; value: string }> = [
    { fieldPath: 'storeId', value: storeId },
    { fieldPath: 'storeSlug', value: storeId },
  ];

  const normalizedStoreName = storeId
    .split('-')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' ');

  if (normalizedStoreName) {
    fallbackLookups.push({ fieldPath: 'storeName', value: normalizedStoreName });
  }

  let matchedProducts: StoreEnrichedProduct[] = [];
  for (const lookup of fallbackLookups) {
    const rows = await runPublicProductsQuery(buildStoreQuery(lookup.fieldPath, lookup.value));
    matchedProducts = normalizeStoreNamesByStoreId(
      rows
        .flatMap((row) => (row.document ? [productFromDocument(row.document)] : []))
        .filter((item) => item.id && item.productName && item.imageUrls.length > 0 && item.verified === true),
    );

    if (matchedProducts.length > 0) {
      break;
    }
  }

  if (matchedProducts.length === 0) {
    return null;
  }

  const head = matchedProducts[0];
  const sameAs = Array.from(new Set(matchedProducts.flatMap((item) => item.sameAs))).filter(isValidHttpUrl);

  return {
    storeId: head.storeId ?? storeId,
    storeName: head.storeName,
    storeSlug: head.storeSlug,
    storePhone: head.storePhone,
    websiteUrl: isValidHttpUrl(head.storeWebsiteUrl) ? head.storeWebsiteUrl : undefined,
    storeLogoUrl: isValidHttpUrl(head.storeLogoUrl) ? head.storeLogoUrl : undefined,
    storeBannerUrl: isValidHttpUrl(head.storeBannerUrl) ? head.storeBannerUrl : undefined,
    city: head.city,
    country: head.country,
    addressLine1: head.addressLine1,
    sameAs,
    products: matchedProducts.map(toPublicProductDetail),
    verified: true,
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
        { fieldPath: 'town' },
        { fieldPath: 'country' },
        { fieldPath: 'storeCountry' },
        { fieldPath: 'waLink' },
        { fieldPath: 'publishedAt' },
        { fieldPath: 'verified' },
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
          {
            fieldFilter: {
              field: { fieldPath: 'verified' },
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
  const items = normalizeStoreNamesByStoreId(rows.flatMap((row) => (row.document ? [productFromDocument(row.document)] : [])))
    .map(toPublicProductDetail)
    .filter((item) => item.id && item.productName && item.imageUrls.length > 0 && item.verified === true);

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
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'isVisible' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: 'verified' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
    limit: limitCount,
  };

  let rows: FirestoreRunQueryResponse[] = [];
  try {
    rows = await runPublicProductsQuery(query);
  } catch (error) {
    console.warn('Unable to list public category keys during static generation.', error);
    return [];
  }

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
      compositeFilter: {
        op: 'AND',
        filters: [
          {
            fieldFilter: {
              field: { fieldPath: 'isVisible' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
          {
            fieldFilter: {
              field: { fieldPath: 'verified' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
        ],
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
