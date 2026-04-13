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
  storeEmail?: string;
  storePhone?: string;
  storeWhatsapp?: string;
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
  storeEmail?: string;
};

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY;
const normalizeRouteId = (value: string): string => {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
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
    .filter((item) => item.length > 0);
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
    storeEmail: readString(fields, ['storeEmail', 'email', 'ownerEmail', 'contactEmail']),
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
  const normalizedStoreId = normalizeRouteId(storeId);

  if (!normalizedStoreId || !projectId) {
    return null;
  }

  const withProfileDefaults = (profile: Partial<StoreProfile> & Pick<StoreProfile, 'storeId' | 'storeName' | 'verified'>): StoreProfile => ({
    storeId: profile.storeId,
    storeName: profile.storeName,
    storeSlug: profile.storeSlug ?? undefined,
    storeEmail: profile.storeEmail ?? undefined,
    storePhone: profile.storePhone ?? undefined,
    storeWhatsapp: profile.storeWhatsapp ?? undefined,
    websiteUrl: profile.websiteUrl ?? undefined,
    storeLogoUrl: profile.storeLogoUrl ?? undefined,
    storeBannerUrl: profile.storeBannerUrl ?? undefined,
    city: profile.city ?? undefined,
    country: profile.country ?? undefined,
    addressLine1: profile.addressLine1 ?? undefined,
    sameAs: Array.isArray(profile.sameAs) ? profile.sameAs : [],
    products: Array.isArray(profile.products) ? profile.products : [],
    verified: profile.verified,
  });

  const toStoreProfileFromDocument = (document: FirestoreDocument, fallbackStoreId: string): Omit<StoreProfile, 'products'> => {
    const fields = document.fields ?? {};

    return {
      storeId: readString(fields, ['storeId']) ?? fallbackStoreId,
      storeName: readString(fields, ['displayName', 'storeName', 'name']) ?? 'Unknown store',
      storeSlug: readString(fields, ['storeSlug', 'slug']),
      storeEmail: readString(fields, ['email', 'ownerEmail', 'contactEmail']),
      storePhone: readString(fields, ['storePhone', 'phone', 'telephone', 'whatsappNumber']),
      storeWhatsapp: readString(fields, ['waLink', 'whatsappNumber']),
      websiteUrl: readString(fields, ['websiteUrl', 'website']),
      storeLogoUrl: readString(fields, ['storeLogoUrl', 'logoUrl']),
      storeBannerUrl: readString(fields, ['storeBannerUrl', 'bannerUrl']),
      city: readString(fields, ['city', 'storeCity']),
      country: readString(fields, ['country', 'storeCountry']),
      addressLine1: readString(fields, ['addressLine1', 'address']),
      verified: readBoolean(fields, ['verified']) ?? false,
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

  const readStoreDocumentById = async () => {
    const endpoint = new URL(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stores/${encodeURIComponent(normalizedStoreId)}`,
    );

    if (firebaseApiKey) {
      endpoint.searchParams.set('key', firebaseApiKey);
    }

    [
      'name',
      'displayName',
      'storeName',
      'slug',
      'storeSlug',
      'email',
      'ownerEmail',
      'phone',
      'telephone',
      'storePhone',
      'whatsappNumber',
      'waLink',
      'websiteUrl',
      'logoUrl',
      'storeLogoUrl',
      'bannerUrl',
      'storeBannerUrl',
      'city',
      'storeCity',
      'country',
      'storeCountry',
      'addressLine1',
      'address',
      'instagramUrl',
      'facebookUrl',
      'xUrl',
      'twitterUrl',
      'tiktokUrl',
      'youtubeUrl',
      'verified',
    ].forEach((fieldPath) => endpoint.searchParams.append('mask.fieldPaths', fieldPath));

    const response = await fetch(endpoint, {
      next: { revalidate: 300 },
    });

    if (response.status === 404 || response.status === 403) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to load store ${normalizedStoreId}. Status: ${response.status}`);
    }

    const document = (await response.json()) as FirestoreDocument;
    return toStoreProfileFromDocument(document, normalizedStoreId);
  };

  const readStoreDocumentByField = async (fieldPath: 'storeSlug' | 'slug' | 'storeName', value: string) => {
    const rows = await runPublicProductsQuery({
      from: [{ collectionId: 'stores' }],
      where: {
        fieldFilter: {
          field: { fieldPath },
          op: 'EQUAL',
          value: { stringValue: value },
        },
      },
      limit: 1,
    });

    const document = rows.find((row) => row.document)?.document;
    return document ? toStoreProfileFromDocument(document, normalizedStoreId) : null;
  };

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
        { fieldPath: 'email' },
        { fieldPath: 'ownerEmail' },
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
    { fieldPath: 'storeId', value: normalizedStoreId },
    { fieldPath: 'storeSlug', value: normalizedStoreId },
  ];

  const normalizedStoreName = normalizedStoreId
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

  const profileFromProducts: StoreProfile | null =
    matchedProducts.length === 0
      ? null
      : {
          storeId: matchedProducts[0].storeId ?? normalizedStoreId,
          storeName: matchedProducts[0].storeName,
          storeSlug: matchedProducts[0].storeSlug,
          storeEmail: matchedProducts[0].storeEmail,
          storePhone: matchedProducts[0].storePhone,
          storeWhatsapp: matchedProducts[0].waLink,
          websiteUrl: isValidHttpUrl(matchedProducts[0].storeWebsiteUrl) ? matchedProducts[0].storeWebsiteUrl : undefined,
          storeLogoUrl: isValidHttpUrl(matchedProducts[0].storeLogoUrl) ? matchedProducts[0].storeLogoUrl : undefined,
          storeBannerUrl: isValidHttpUrl(matchedProducts[0].storeBannerUrl) ? matchedProducts[0].storeBannerUrl : undefined,
          city: matchedProducts[0].city,
          country: matchedProducts[0].country,
          addressLine1: matchedProducts[0].addressLine1,
          sameAs: Array.from(new Set(matchedProducts.flatMap((item) => item.sameAs))).filter(isValidHttpUrl),
          products: matchedProducts.map(toPublicProductDetail),
          verified: matchedProducts[0].verified === true,
        };

  try {
    const storeDocument =
      (await readStoreDocumentById()) ??
      (await readStoreDocumentByField('storeSlug', normalizedStoreId)) ??
      (await readStoreDocumentByField('slug', normalizedStoreId));

    if (!storeDocument && !profileFromProducts) {
      return null;
    }

    if (!storeDocument && profileFromProducts) {
      return withProfileDefaults(profileFromProducts);
    }

    if (storeDocument && !profileFromProducts) {
      return withProfileDefaults({ ...storeDocument, products: [] });
    }

    const mergedProfile = profileFromProducts as StoreProfile;
    const mergedSameAs = Array.from(new Set([...(storeDocument?.sameAs ?? []), ...mergedProfile.sameAs])).filter(isValidHttpUrl);
    return withProfileDefaults({
      ...mergedProfile,
      storeId: storeDocument?.storeId || mergedProfile.storeId,
      storeName: storeDocument?.storeName || mergedProfile.storeName,
      storeSlug: storeDocument?.storeSlug ?? mergedProfile.storeSlug,
      storeEmail: storeDocument?.storeEmail ?? mergedProfile.storeEmail,
      storePhone: storeDocument?.storePhone ?? mergedProfile.storePhone,
      storeWhatsapp: storeDocument?.storeWhatsapp ?? mergedProfile.storeWhatsapp,
      websiteUrl: isValidHttpUrl(storeDocument?.websiteUrl) ? storeDocument?.websiteUrl : mergedProfile.websiteUrl,
      storeLogoUrl: isValidHttpUrl(storeDocument?.storeLogoUrl) ? storeDocument?.storeLogoUrl : mergedProfile.storeLogoUrl,
      storeBannerUrl: isValidHttpUrl(storeDocument?.storeBannerUrl) ? storeDocument?.storeBannerUrl : mergedProfile.storeBannerUrl,
      city: storeDocument?.city ?? mergedProfile.city,
      country: storeDocument?.country ?? mergedProfile.country,
      addressLine1: storeDocument?.addressLine1 ?? mergedProfile.addressLine1,
      verified: Boolean(storeDocument?.verified || mergedProfile.verified),
      sameAs: mergedSameAs,
    });
  } catch {
    return profileFromProducts ? withProfileDefaults(profileFromProducts) : null;
  }
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
