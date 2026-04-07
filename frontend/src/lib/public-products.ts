export type PublicProductDetail = {
  id: string;
  storeId?: string;
  productName: string;
  description: string;
  imageUrls: string[];
  price?: number;
  currency?: string;
  storeName: string;
  categoryKey?: string;
  sku?: string;
  stockCount?: number;
  city?: string;
  country?: string;
  waLink?: string;
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
  if (!value || !('arrayValue' in value) || !Array.isArray(value.arrayValue.values)) {
    return [];
  }

  return value.arrayValue.values
    .flatMap((item) => ('stringValue' in item ? [item.stringValue.trim()] : []))
    .filter(Boolean);
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
const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY;

const productFromDocument = (doc: FirestoreDocument): PublicProductDetail => {
  const fields = doc.fields ?? {};
  const imageUrls = readStringArray(fields, 'imageUrls').filter(isValidImageUrl);

  return {
    id: doc.name.split('/').at(-1) ?? '',
    storeId: readString(fields, ['storeId']),
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
  };
};

export const getPublicProductById = async (productId: string): Promise<PublicProductDetail | null> => {
  if (!projectId || !productId) {
    return null;
  }

  const endpoint = new URL(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/publicProducts/${encodeURIComponent(productId)}`,
  );

  if (firebaseApiKey) {
    endpoint.searchParams.set('key', firebaseApiKey);
  }

  const response = await fetch(endpoint, {
    next: { revalidate: 300 },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch public product ${productId}. Status: ${response.status}`);
  }

  const document = (await response.json()) as FirestoreDocument;
  return productFromDocument(document);
};
