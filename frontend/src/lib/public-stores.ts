import type { PublicProductDetail } from '@/lib/public-products';
import { CANONICAL_CATEGORY_KEYS, resolveClosestCategoryKey } from '@/lib/category-taxonomy';

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

const WEBSITE_FIELD_KEYS = ['websiteUrl', 'storeWebsiteUrl', 'storeWebsite', 'website', 'websiteLink', 'promoWebsiteUrl'] as const;
const WEBSITE_MASK_FIELD_KEYS = [...WEBSITE_FIELD_KEYS];

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
  area?: string;
  openingHours?: string;
  latitude?: number;
  longitude?: number;
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
  itemType?: string;
  storeEmail?: string;
  isVisible?: boolean;
  isPublished?: boolean;
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

const readString = (fields: Record<string, FirestoreValue>, keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = fields[key];
    if (value && 'stringValue' in value) {
      const normalized = value.stringValue.trim();
      if (normalized.length > 0) return normalized;
    }
  }
  return undefined;
};

const readMapString = (fields: Record<string, FirestoreValue>, mapKeys: readonly string[], childKeys: readonly string[]): string | undefined => {
  for (const mapKey of mapKeys) {
    const mapValue = fields[mapKey];
    if (!mapValue || !('mapValue' in mapValue)) continue;
    const childFields = mapValue.mapValue.fields ?? {};
    const found = readString(childFields, childKeys);
    if (found) return found;
  }
  return undefined;
};

const readNumber = (fields: Record<string, FirestoreValue>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = fields[key];
    if (value && 'doubleValue' in value && Number.isFinite(value.doubleValue)) return value.doubleValue;
    if (value && 'integerValue' in value) {
      const parsed = Number(value.integerValue);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const readMapNumber = (fields: Record<string, FirestoreValue>, mapKeys: readonly string[], childKeys: string[]): number | undefined => {
  for (const mapKey of mapKeys) {
    const mapValue = fields[mapKey];
    if (!mapValue || !('mapValue' in mapValue)) continue;
    const childFields = mapValue.mapValue.fields ?? {};
    const found = readNumber(childFields, childKeys);
    if (typeof found === 'number') return found;
  }
  return undefined;
};

const readStringArray = (fields: Record<string, FirestoreValue>, key: string): string[] => {
  const value = fields[key];
  if (!value) return [];
  if ('stringValue' in value) {
    const normalized = value.stringValue.trim();
    if (!normalized) return [];
    if (normalized.startsWith('[') && normalized.endsWith(']')) {
      try {
        const parsed = JSON.parse(normalized);
        if (Array.isArray(parsed)) return parsed.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
      } catch {
        return [normalized];
      }
    }
    return [normalized];
  }
  if (!('arrayValue' in value) || !Array.isArray(value.arrayValue.values)) return [];
  return value.arrayValue.values.flatMap((item) => ('stringValue' in item ? [item.stringValue.trim()] : [])).filter((item) => item.length > 0);
};

const readBoolean = (fields: Record<string, FirestoreValue>, keys: string[]): boolean | undefined => {
  for (const key of keys) {
    const value = fields[key];
    if (value && 'booleanValue' in value) return value.booleanValue;
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
  const normalizedInput = input.trim().toLowerCase().startsWith('gs://') ? input.trim().replace(/^gs:\/\//i, 'https://storage.googleapis.com/') : input;
  try {
    const parsed = new URL(normalizedInput);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeImageUrl = (value: string): string =>
  value.trim().toLowerCase().startsWith('gs://') ? value.trim().replace(/^gs:\/\//i, 'https://storage.googleapis.com/') : value.trim();

const productFromDocument = (doc: FirestoreDocument): StoreEnrichedProduct => {
  const fields = doc.fields ?? {};
  const imageUrls = Array.from(new Set([
    ...readStringArray(fields, 'imageUrls'),
    ...readStringArray(fields, 'imageUrl'),
    ...readStringArray(fields, 'image'),
    ...readStringArray(fields, 'serviceImageUrls'),
    ...readStringArray(fields, 'serviceImageUrl'),
    ...readStringArray(fields, 'serviceImage'),
  ])).map(normalizeImageUrl).filter(isValidHttpUrl);

  const websiteUrl = readString(fields, WEBSITE_FIELD_KEYS);

  return {
    id: readString(fields, ['productId']) ?? doc.name?.split('/').at(-1) ?? '',
    productName: readString(fields, ['productName', 'name']) ?? 'Untitled item',
    description: readString(fields, ['description']) ?? '',
    imageUrls,
    price: readNumber(fields, ['price']),
    currency: readString(fields, ['currency']),
    storeName: readString(fields, ['storeName']) ?? 'Unknown store',
    categoryKey: resolveClosestCategoryKey({ category: readString(fields, ['categoryKey', 'category']), productName: readString(fields, ['productName', 'name']), description: readString(fields, ['description']), itemType: readString(fields, ['itemType', 'type']) }),
    sku: readString(fields, ['sku']),
    stockCount: readNumber(fields, ['stockCount']),
    city: readString(fields, ['city', 'storeCity', 'town']),
    country: readString(fields, ['country', 'storeCountry']),
    area: readString(fields, ['area', 'locationArea', 'storeArea']),
    publicLocationArea: readString(fields, ['publicLocationArea', 'area', 'locationArea', 'storeArea']),
    publicLocationCity: readString(fields, ['publicLocationCity', 'city', 'storeCity', 'town']),
    publicLocationCountry: readString(fields, ['publicLocationCountry', 'country', 'storeCountry']),
    deliveryOriginArea: readString(fields, ['deliveryOriginArea', 'dispatchArea', 'pickupArea', 'publicLocationArea', 'area', 'locationArea']),
    deliveryOriginCity: readString(fields, ['deliveryOriginCity', 'dispatchCity', 'pickupCity', 'publicLocationCity', 'city', 'storeCity', 'town']),
    deliveryOriginCountry: readString(fields, ['deliveryOriginCountry', 'dispatchCountry', 'pickupCountry', 'publicLocationCountry', 'country', 'storeCountry']),
    pickupAddress: readString(fields, ['pickupAddress', 'pickupLocation', 'publicPickupAddress']),
    pickupAvailable: readBoolean(fields, ['pickupAvailable', 'allowPickup', 'storePickupAvailable']),
    deliveryAvailable: readBoolean(fields, ['deliveryAvailable', 'allowDelivery', 'storeDeliveryAvailable']),
    sameDayDeliveryAvailable: readBoolean(fields, ['sameDayDeliveryAvailable', 'sameDayDelivery', 'allowSameDayDelivery']),
    sameDayCutoffTime: readString(fields, ['sameDayCutoffTime', 'deliveryCutoffTime', 'cutoffTime']),
    waLink: readString(fields, ['waLink']),
    storeId: readString(fields, ['storeId']),
    storePhone: readString(fields, ['storePhone', 'phone', 'telephone', 'whatsappNumber']),
    storeSlug: readString(fields, ['storeSlug']),
    storeLogoUrl: readString(fields, ['storeLogoUrl', 'logoUrl']),
    storeBannerUrl: readString(fields, ['storeBannerUrl', 'bannerUrl']),
    storeWebsiteUrl: websiteUrl,
    storeEmail: readString(fields, ['storeEmail', 'email', 'ownerEmail', 'contactEmail']),
    addressLine1: readString(fields, ['addressLine1', 'address']),
    verified: readBoolean(fields, ['verified']),
    itemType: readString(fields, ['itemType', 'type']),
    listingType: readString(fields, ['listingType']),
    isVisible: readBoolean(fields, ['isVisible']),
    isPublished: readBoolean(fields, ['isPublished']),
    sameAs: [readString(fields, ['instagramUrl']), readString(fields, ['facebookUrl']), readString(fields, ['xUrl', 'twitterUrl']), readString(fields, ['tiktokUrl']), readString(fields, ['youtubeUrl']), websiteUrl].filter(isValidHttpUrl),
  };
};

const productIsEligibleForSedifexMarket = (product: StoreEnrichedProduct): boolean => product.verified === true;

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
  area: product.area,
  publicLocationArea: product.publicLocationArea,
  publicLocationCity: product.publicLocationCity,
  publicLocationCountry: product.publicLocationCountry,
  deliveryOriginArea: product.deliveryOriginArea,
  deliveryOriginCity: product.deliveryOriginCity,
  deliveryOriginCountry: product.deliveryOriginCountry,
  pickupAddress: product.pickupAddress,
  pickupAvailable: product.pickupAvailable,
  deliveryAvailable: product.deliveryAvailable,
  sameDayDeliveryAvailable: product.sameDayDeliveryAvailable,
  sameDayCutoffTime: product.sameDayCutoffTime,
  waLink: product.waLink,
  verified: product.verified,
  itemType: product.itemType,
  listingType: product.listingType,
});

const normalizeStoreNamesByStoreId = (products: StoreEnrichedProduct[]): StoreEnrichedProduct[] => {
  const canonicalNamesByStoreId = new Map<string, string>();
  products.forEach((product) => {
    const storeId = product.storeId?.trim();
    const storeName = product.storeName?.trim();
    if (!storeId || !storeName) return;
    if (!canonicalNamesByStoreId.has(storeId)) canonicalNamesByStoreId.set(storeId, storeName);
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
  if (!projectId) return [];
  const endpoint = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`);
  if (firebaseApiKey) endpoint.searchParams.set('key', firebaseApiKey);
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery }), next: { revalidate: 300 } });
  if (!response.ok) {
    let details = '';
    try {
      const errorBody = (await response.json()) as { error?: { message?: string; status?: string } };
      const message = errorBody?.error?.message?.trim();
      const status = errorBody?.error?.status?.trim();
      details = [status, message].filter(Boolean).join(': ');
    } catch { details = ''; }
    const suffix = details ? ` (${details})` : '';
    throw new Error(`Failed to query publicProducts. Status: ${response.status}${suffix}`);
  }
  return (await response.json()) as FirestoreRunQueryResponse[];
};

const runPublicProductsQuerySafely = async (structuredQuery: Record<string, unknown>, context: string): Promise<FirestoreRunQueryResponse[]> => {
  try { return await runPublicProductsQuery(structuredQuery); }
  catch (error) { console.warn(`Unable to query publicProducts for ${context}.`, error); return []; }
};

export const getStoreProfileById = async (storeId: string): Promise<StoreProfile | null> => {
  const normalizedStoreId = normalizeRouteId(storeId);
  if (!normalizedStoreId || !projectId) return null;

  const readStoreDocumentById = async () => {
    const endpoint = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/stores/${encodeURIComponent(normalizedStoreId)}`);
    if (firebaseApiKey) endpoint.searchParams.set('key', firebaseApiKey);

    [
      'name','displayName','storeName','slug','storeSlug','email','ownerEmail','phone','telephone','storePhone','whatsappNumber','waLink',
      ...WEBSITE_MASK_FIELD_KEYS,
      'logoUrl','storeLogoUrl','bannerUrl','storeBannerUrl','city','storeCity','town','country','storeCountry','addressLine1','address',
      'instagramUrl','facebookUrl','xUrl','twitterUrl','tiktokUrl','youtubeUrl','verified','status','openingHours','businessHours','area','locationArea',
      'latitude','lat','longitude','lng','primaryLocation','primary_location','location','businessLocation','storeLocation',
    ].forEach((fieldPath) => endpoint.searchParams.append('mask.fieldPaths', fieldPath));

    const response = await fetch(endpoint, { next: { revalidate: 300 } });
    if (response.status === 404 || response.status === 403) return null;
    if (!response.ok) throw new Error(`Failed to load store ${normalizedStoreId}. Status: ${response.status}`);

    const document = (await response.json()) as FirestoreDocument;
    const fields = document.fields ?? {};
    const websiteUrl = readString(fields, WEBSITE_FIELD_KEYS);
    const locationMaps = ['primaryLocation', 'primary_location', 'location', 'businessLocation', 'storeLocation'] as const;

    return {
      storeId: normalizedStoreId,
      storeName: readString(fields, ['displayName', 'storeName', 'name']) ?? 'Unknown store',
      storeSlug: readString(fields, ['storeSlug', 'slug']),
      storeEmail: readString(fields, ['email', 'ownerEmail', 'contactEmail']),
      storePhone: readString(fields, ['storePhone', 'phone', 'telephone', 'whatsappNumber']),
      storeWhatsapp: readString(fields, ['waLink', 'whatsappNumber']),
      websiteUrl,
      storeLogoUrl: readString(fields, ['storeLogoUrl', 'logoUrl']),
      storeBannerUrl: readString(fields, ['storeBannerUrl', 'bannerUrl']),
      city: readMapString(fields, locationMaps, ['city', 'town', 'areaCity']) ?? readString(fields, ['city', 'storeCity', 'town']),
      country: readMapString(fields, locationMaps, ['country', 'countryName']) ?? readString(fields, ['country', 'storeCountry']),
      addressLine1: readMapString(fields, locationMaps, ['addressLine1', 'address', 'fullAddress', 'streetAddress', 'landmark']) ?? readString(fields, ['addressLine1', 'address']),
      area: readMapString(fields, locationMaps, ['area', 'locationArea', 'town', 'neighborhood', 'suburb']) ?? readString(fields, ['area', 'locationArea', 'town']),
      openingHours: readString(fields, ['openingHours', 'businessHours']),
      latitude: readMapNumber(fields, locationMaps, ['latitude', 'lat']) ?? readNumber(fields, ['latitude', 'lat']),
      longitude: readMapNumber(fields, locationMaps, ['longitude', 'lng']) ?? readNumber(fields, ['longitude', 'lng']),
      verified: readBoolean(fields, ['verified']) ?? false,
      sameAs: [readString(fields, ['instagramUrl']), readString(fields, ['facebookUrl']), readString(fields, ['xUrl', 'twitterUrl']), readString(fields, ['tiktokUrl']), readString(fields, ['youtubeUrl']), websiteUrl].filter(isValidHttpUrl),
      products: [],
    };
  };

  const buildStoreQuery = (fieldPath: 'storeId' | 'storeSlug' | 'storeName', value: string) => ({
    select: { fields: [
      { fieldPath: 'productId' }, { fieldPath: 'storeId' }, { fieldPath: 'productName' }, { fieldPath: 'name' }, { fieldPath: 'description' },
      { fieldPath: 'imageUrls' }, { fieldPath: 'imageUrl' }, { fieldPath: 'image' }, { fieldPath: 'price' }, { fieldPath: 'currency' },
      { fieldPath: 'storeName' }, { fieldPath: 'categoryKey' }, { fieldPath: 'category' }, { fieldPath: 'sku' }, { fieldPath: 'stockCount' },
      { fieldPath: 'city' }, { fieldPath: 'storeCity' }, { fieldPath: 'town' }, { fieldPath: 'country' }, { fieldPath: 'storeCountry' },
      { fieldPath: 'waLink' }, { fieldPath: 'storePhone' }, { fieldPath: 'phone' }, { fieldPath: 'telephone' }, { fieldPath: 'whatsappNumber' },
      { fieldPath: 'storeSlug' }, { fieldPath: 'storeLogoUrl' }, { fieldPath: 'logoUrl' }, { fieldPath: 'storeBannerUrl' }, { fieldPath: 'bannerUrl' },
      { fieldPath: 'addressLine1' }, { fieldPath: 'address' }, { fieldPath: 'instagramUrl' }, { fieldPath: 'facebookUrl' }, { fieldPath: 'xUrl' },
      { fieldPath: 'twitterUrl' }, { fieldPath: 'tiktokUrl' }, { fieldPath: 'youtubeUrl' }, ...WEBSITE_MASK_FIELD_KEYS.map((fieldPath) => ({ fieldPath })),
      { fieldPath: 'email' }, { fieldPath: 'ownerEmail' }, { fieldPath: 'publishedAt' }, { fieldPath: 'verified' }, { fieldPath: 'itemType' },
      { fieldPath: 'type' }, { fieldPath: 'isVisible' }, { fieldPath: 'isPublished' },
    ] },
    from: [{ collectionId: 'publicProducts' }],
    where: { fieldFilter: { field: { fieldPath }, op: 'EQUAL', value: { stringValue: value } } },
    limit: 60,
  });

  const fallbackLookups: Array<{ fieldPath: 'storeId' | 'storeSlug' | 'storeName'; value: string }> = [
    { fieldPath: 'storeId', value: normalizedStoreId },
    { fieldPath: 'storeSlug', value: normalizedStoreId },
  ];
  const normalizedStoreName = normalizedStoreId.split('-').map((part) => part.trim()).filter((part) => part.length > 0).join(' ');
  if (normalizedStoreName) fallbackLookups.push({ fieldPath: 'storeName', value: normalizedStoreName });

  let matchedProducts: StoreEnrichedProduct[] = [];
  for (const lookup of fallbackLookups) {
    const rows = await runPublicProductsQuerySafely(buildStoreQuery(lookup.fieldPath, lookup.value), `${lookup.fieldPath}=${lookup.value}`);
    matchedProducts = normalizeStoreNamesByStoreId(rows.flatMap((row) => (row.document ? [productFromDocument(row.document)] : [])).filter((item) => item.id && item.productName && item.imageUrls.length > 0 && productIsEligibleForSedifexMarket(item)));
    if (matchedProducts.length > 0) break;
  }

  const storeDocument = await readStoreDocumentById().catch(() => null);
  const isStoreVerifiedFromStoreData = storeDocument?.verified === true;
  if (!isStoreVerifiedFromStoreData) return null;

  if (matchedProducts.length === 0) return { ...storeDocument, products: [], verified: isStoreVerifiedFromStoreData };

  const head = matchedProducts[0];
  const sameAs = Array.from(new Set(matchedProducts.flatMap((item) => item.sameAs))).filter(isValidHttpUrl);
  const profileFromProducts: StoreProfile = {
    storeId: head.storeId ?? normalizedStoreId,
    storeName: head.storeName,
    storeSlug: head.storeSlug,
    storeEmail: head.storeEmail,
    storePhone: head.storePhone,
    storeWhatsapp: head.waLink,
    websiteUrl: isValidHttpUrl(head.storeWebsiteUrl) ? head.storeWebsiteUrl : undefined,
    storeLogoUrl: isValidHttpUrl(head.storeLogoUrl) ? head.storeLogoUrl : undefined,
    storeBannerUrl: isValidHttpUrl(head.storeBannerUrl) ? head.storeBannerUrl : undefined,
    city: head.city,
    country: head.country,
    addressLine1: head.addressLine1,
    area: head.addressLine1,
    sameAs,
    products: matchedProducts.map(toPublicProductDetail),
    verified: isStoreVerifiedFromStoreData,
  };

  if (!storeDocument) return profileFromProducts;
  const mergedSameAs = Array.from(new Set([...storeDocument.sameAs, ...profileFromProducts.sameAs])).filter(isValidHttpUrl);
  return {
    ...profileFromProducts,
    storeName: storeDocument.storeName || profileFromProducts.storeName,
    storeSlug: storeDocument.storeSlug ?? profileFromProducts.storeSlug,
    storeEmail: storeDocument.storeEmail ?? profileFromProducts.storeEmail,
    storePhone: storeDocument.storePhone ?? profileFromProducts.storePhone,
    storeWhatsapp: storeDocument.storeWhatsapp ?? profileFromProducts.storeWhatsapp,
    websiteUrl: isValidHttpUrl(storeDocument.websiteUrl) ? storeDocument.websiteUrl : profileFromProducts.websiteUrl,
    storeLogoUrl: isValidHttpUrl(storeDocument.storeLogoUrl) ? storeDocument.storeLogoUrl : profileFromProducts.storeLogoUrl,
    storeBannerUrl: isValidHttpUrl(storeDocument.storeBannerUrl) ? storeDocument.storeBannerUrl : profileFromProducts.storeBannerUrl,
    city: storeDocument.city ?? profileFromProducts.city,
    country: storeDocument.country ?? profileFromProducts.country,
    addressLine1: storeDocument.addressLine1 ?? profileFromProducts.addressLine1,
    area: storeDocument.area ?? profileFromProducts.area,
    openingHours: storeDocument.openingHours ?? profileFromProducts.openingHours,
    latitude: storeDocument.latitude ?? profileFromProducts.latitude,
    longitude: storeDocument.longitude ?? profileFromProducts.longitude,
    verified: isStoreVerifiedFromStoreData,
    sameAs: mergedSameAs,
  };
};

export const getProductsByCategory = async (categoryKey: string, options: { page?: number; pageSize?: number } = {}): Promise<CategoryProductPage> => {
  if (!categoryKey || !projectId) return { products: [], hasMore: false };
  const pageSize = Math.min(Math.max(options.pageSize ?? 24, 1), 48);
  const page = Math.max(options.page ?? 1, 1);
  const offset = (page - 1) * pageSize;
  const normalizedCategoryKey = resolveClosestCategoryKey({ category: categoryKey });
  const baseQuery = {
    select: { fields: [
      { fieldPath: 'productId' }, { fieldPath: 'storeId' }, { fieldPath: 'productName' }, { fieldPath: 'name' }, { fieldPath: 'description' },
      { fieldPath: 'imageUrls' }, { fieldPath: 'imageUrl' }, { fieldPath: 'image' }, { fieldPath: 'price' }, { fieldPath: 'currency' },
      { fieldPath: 'storeName' }, { fieldPath: 'categoryKey' }, { fieldPath: 'category' }, { fieldPath: 'sku' }, { fieldPath: 'stockCount' },
      { fieldPath: 'city' }, { fieldPath: 'storeCity' }, { fieldPath: 'town' }, { fieldPath: 'country' }, { fieldPath: 'storeCountry' },
      { fieldPath: 'area' }, { fieldPath: 'locationArea' }, { fieldPath: 'storeArea' }, { fieldPath: 'publicLocationArea' },
      { fieldPath: 'publicLocationCity' }, { fieldPath: 'publicLocationCountry' }, { fieldPath: 'deliveryOriginArea' },
      { fieldPath: 'deliveryOriginCity' }, { fieldPath: 'deliveryOriginCountry' }, { fieldPath: 'dispatchArea' },
      { fieldPath: 'dispatchCity' }, { fieldPath: 'dispatchCountry' }, { fieldPath: 'pickupArea' }, { fieldPath: 'pickupCity' },
      { fieldPath: 'pickupCountry' }, { fieldPath: 'pickupAddress' }, { fieldPath: 'pickupLocation' }, { fieldPath: 'publicPickupAddress' },
      { fieldPath: 'pickupAvailable' }, { fieldPath: 'allowPickup' }, { fieldPath: 'storePickupAvailable' },
      { fieldPath: 'deliveryAvailable' }, { fieldPath: 'allowDelivery' }, { fieldPath: 'storeDeliveryAvailable' },
      { fieldPath: 'sameDayDeliveryAvailable' }, { fieldPath: 'sameDayDelivery' }, { fieldPath: 'allowSameDayDelivery' },
      { fieldPath: 'sameDayCutoffTime' }, { fieldPath: 'deliveryCutoffTime' }, { fieldPath: 'cutoffTime' },
      { fieldPath: 'waLink' }, { fieldPath: 'publishedAt' }, { fieldPath: 'itemType' }, { fieldPath: 'type' }, { fieldPath: 'listingType' }, { fieldPath: 'verified' },
    ] },
    from: [{ collectionId: 'publicProducts' }],
    where: { fieldFilter: { field: { fieldPath: 'verified' }, op: 'EQUAL', value: { booleanValue: true } } },
    orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
  };
  const matchingItems: PublicProductDetail[] = [];
  let queryOffset = 0;
  let exhausted = false;
  while (matchingItems.length < offset + pageSize + 1 && !exhausted) {
    const rows = await runPublicProductsQuery({ ...baseQuery, offset: queryOffset, limit: 150 });
    const batchItems = normalizeStoreNamesByStoreId(rows.flatMap((row) => (row.document ? [productFromDocument(row.document)] : [])))
      .map(toPublicProductDetail)
      .filter((item) => item.id && item.productName && item.imageUrls.length > 0 && resolveClosestCategoryKey({ category: item.categoryKey, productName: item.productName, description: item.description, itemType: item.itemType }) === normalizedCategoryKey);
    matchingItems.push(...batchItems);
    if (rows.length < 150) exhausted = true;
    queryOffset += 150;
  }
  return { products: matchingItems.slice(offset, offset + pageSize), hasMore: matchingItems.length > offset + pageSize };
};

export const listPublicCategoryKeys = async (limitCount = 600): Promise<string[]> => {
  void limitCount;
  return [...CANONICAL_CATEGORY_KEYS];
};

export const listPublicStoreIds = async (limitCount = 200): Promise<string[]> => {
  const query = { select: { fields: [{ fieldPath: 'storeId' }, { fieldPath: 'publishedAt' }, { fieldPath: 'isVisible' }, { fieldPath: 'isPublished' }] }, from: [{ collectionId: 'publicProducts' }], limit: limitCount };
  const rows = await runPublicProductsQuerySafely(query, 'public store ids');
  const idsFromPublicProducts = rows.flatMap((row) => (row.document ? [productFromDocument(row.document)] : [])).flatMap((product) => (product.storeId ? [product.storeId] : []));
  const storesQuery = {
    select: { fields: [{ fieldPath: 'storeId' }] },
    from: [{ collectionId: 'stores' }],
    where: { compositeFilter: { op: 'AND', filters: [
      { fieldFilter: { field: { fieldPath: 'verified' }, op: 'EQUAL', value: { booleanValue: true } } },
      { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'active' } } },
    ] } },
    limit: limitCount,
  };
  const storeRows = await runPublicProductsQuerySafely(storesQuery, 'stores listing');
  const idsFromStores = storeRows.flatMap((row) => (row.document ? [row.document] : [])).flatMap((doc) => {
    const storeIdFromName = doc.name?.split('/').at(-1);
    const storeIdFromField = doc.fields && readString(doc.fields, ['storeId']);
    return [storeIdFromField, storeIdFromName].filter((id): id is string => Boolean(id && id.trim()));
  });
  return Array.from(new Set([...idsFromPublicProducts, ...idsFromStores]));
};
