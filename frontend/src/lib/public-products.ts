export type PublicProductDetail = {
  id: string;
  storeId?: string;
  productName: string;
  description: string;
  imageUrls: string[];
  imageAlt?: string;
  price?: number;
  currency?: string;
  storeName: string;
  categoryKey?: string;
  sku?: string;
  stockCount?: number;
  city?: string;
  country?: string;
  waLink?: string;
  verified?: boolean;
  itemType?: string;
  rankingScore?: number;
};

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

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

  if (!value) {
    return [];
  }

  if ('stringValue' in value) {
    const normalized = value.stringValue.trim();
    return normalized ? [normalized] : [];
  }

  if (!('arrayValue' in value) || !Array.isArray(value.arrayValue.values)) {
    return [];
  }

  return value.arrayValue.values
    .flatMap((item) => ('stringValue' in item ? [item.stringValue.trim()] : []))
    .filter(Boolean);
};

const readBoolean = (fields: Record<string, FirestoreValue>, keys: string[]): boolean | undefined => {
  for (const key of keys) {
    const value = fields[key];
    if (value && 'booleanValue' in value) {
      return value.booleanValue;
    }
    if (value && 'stringValue' in value) {
      const normalized = value.stringValue.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
      if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    }
  }

  return undefined;
};

const isValidImageUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
const normalizeRouteId = (value: string): string => {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
};

const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY;

const productFromDocument = (doc: FirestoreDocument): PublicProductDetail => {
  const fields = doc.fields ?? {};
  const imageUrls = Array.from(
    new Set([
      ...readStringArray(fields, 'imageUrls'),
      ...readStringArray(fields, 'imageUrl'),
      ...readStringArray(fields, 'image'),
    ]),
  ).filter(isValidImageUrl);

  return {
    id: doc.name.split('/').at(-1) ?? '',
    storeId: readString(fields, ['storeId']),
    productName: readString(fields, ['productName', 'name', 'title']) ?? 'Untitled item',
    description: readString(fields, ['description', 'details']) ?? '',
    imageUrls,
    imageAlt: readString(fields, ['imageAlt']),
    price: readNumber(fields, ['price', 'amount']),
    currency: readString(fields, ['currency']),
    storeName: readString(fields, ['storeName', 'businessName', 'shopName']) ?? 'Unknown store',
    categoryKey: readString(fields, ['categoryKey', 'category']),
    sku: readString(fields, ['sku']),
    stockCount: readNumber(fields, ['stockCount', 'stock']),
    city: readString(fields, ['city', 'storeCity', 'town']),
    country: readString(fields, ['country', 'storeCountry']),
    waLink: readString(fields, ['waLink', 'storePhone', 'phone', 'telephone', 'whatsappNumber']),
    verified: readBoolean(fields, ['verified']),
    itemType: readString(fields, ['itemType', 'type']),
  };
};

export const getPublicProductById = async (productId: string): Promise<PublicProductDetail | null> => {
  const normalizedProductId = normalizeRouteId(productId);

  if (!projectId || !normalizedProductId) {
    return null;
  }

  const endpoint = new URL(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/publicProducts/${encodeURIComponent(normalizedProductId)}`,
  );

  if (firebaseApiKey) {
    endpoint.searchParams.set('key', firebaseApiKey);
  }

  [
    'productName',
    'name',
    'title',
    'description',
    'details',
    'imageUrls',
    'imageUrl',
    'image',
    'imageAlt',
    'price',
    'amount',
    'currency',
    'storeName',
    'businessName',
    'shopName',
    'categoryKey',
    'category',
    'sku',
    'stockCount',
    'stock',
    'city',
    'storeCity',
    'town',
    'country',
    'storeCountry',
    'storeId',
    'waLink',
    'storePhone',
    'phone',
    'telephone',
    'whatsappNumber',
    'verified',
    'itemType',
    'type',
  ].forEach((fieldPath) => endpoint.searchParams.append('mask.fieldPaths', fieldPath));

  const response = await fetch(endpoint, {
    next: { revalidate: 300 },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch public product ${normalizedProductId}. Status: ${response.status}`);
  }

  const document = (await response.json()) as FirestoreDocument;
  const product = productFromDocument(document);
  if (product.imageUrls.length === 0) {
    return null;
  }

  return product;
};


export const listPublicProductIds = async (limitCount = 200): Promise<string[]> => {
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
    body: JSON.stringify({
      structuredQuery: {
        select: { fields: [{ fieldPath: 'publishedAt' }] },
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
            ],
          },
        },
        orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
        limit: limitCount,
      },
    }),
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Failed to list public product ids. Status: ${response.status}`);
  }

  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>;

  return rows
    .flatMap((row) => (row.document?.name ? [row.document.name.split('/').at(-1) ?? ''] : []))
    .filter((id) => id.length > 0);
};
