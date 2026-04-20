import type {
  SedifexCustomer,
  SedifexGalleryItem,
  SedifexProduct,
  SedifexProductSort,
  SedifexPromo,
  SedifexStoreProfile,
} from '@sedifex/integration-types';
import fs from 'node:fs';
import path from 'node:path';

let hasLoadedBackendIntegrationEnv = false;

const ENV_FILE_LOCATIONS = [
  path.resolve(process.cwd(), 'functions/.env.sedifex-web'),
  path.resolve(process.cwd(), '../functions/.env.sedifex-web'),
];

type IntegrationProductsPayload = {
  storeId?: string;
  products?: IntegrationProductRecord[];
  items?: IntegrationProductRecord[];
  publicProducts?: IntegrationProductRecord[];
  publicServices?: IntegrationProductRecord[];
  hasMore?: boolean;
};

type IntegrationStorePayload = IntegrationStoreRecord & {
  store?: IntegrationStoreRecord | null;
  data?: IntegrationStoreRecord | null;
  profile?: IntegrationStoreRecord | null;
  item?: IntegrationStoreRecord | null;
};

type IntegrationProductRecord = Partial<SedifexProduct> & {
  id?: string;
  itemType?: string;
  storeId?: string;
  storeName?: string;
  storeCity?: string;
  storePhone?: string;
  storeEmail?: string;
  websiteLink?: string;
  name?: string;
  category?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  price?: number;
  stockCount?: number | null;
  sourceProductId?: string;
};

type IntegrationStoreRecord = {
  storeId?: string;
  id?: string;
  displayName?: string | null;
  name?: string | null;
  storeName?: string | null;
  workspaceSlug?: string | null;
  storeSlug?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  storePhone?: string | null;
  whatsapp?: string | null;
  whatsappNumber?: string | null;
  addressLine1?: string | null;
  verified?: boolean | null;
  promoTitle?: string | null;
  promoSummary?: string | null;
  promoImageUrl?: string | null;
  promoImageAlt?: string | null;
  promoStartDate?: string | null;
  promoEndDate?: string | null;
  promoSlug?: string | null;
  promoWebsiteUrl?: string | null;
};

type SafeStoreRecord = {
  storeId: string;
  storeName?: string;
  storeSlug?: string;
  city?: string;
  country?: string;
  phone?: string;
  waLink?: string;
  addressLine1?: string;
  verified?: boolean;
};

type IntegrationPromoRecord = {
  id?: string;
  promoId?: string;
  storeId?: string;
  storeName?: string;
  storeSlug?: string;
  city?: string;
  phone?: string;
  whatsapp?: string;
  whatsappNumber?: string;
  addressLine1?: string;
  verified?: boolean;
  displayName?: string;
  name?: string;
  promoTitle?: string;
  title?: string;
  enabled?: boolean;
  promoSummary?: string;
  summary?: string;
  description?: string;
  promoImageUrl?: string;
  imageUrl?: string;
  image?: string;
  promoImageAlt?: string;
  promoStartDate?: string;
  promoEndDate?: string;
  startDate?: string;
  endDate?: string;
  promoSlug?: string;
  slug?: string;
  promoWebsiteUrl?: string;
  websiteUrl?: string;
  promoTiktokUrl?: string;
  tiktokUrl?: string;
  promoYoutubeUrl?: string;
  youtubeUrl?: string;
};

type IntegrationPromoPayload = {
  items?: IntegrationPromoRecord[];
  promos?: IntegrationPromoRecord[];
  profile?: IntegrationPromoRecord | null;
  promo?: IntegrationPromoRecord | null;
};

const cleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const toStoreProfile = (
  profile: IntegrationPromoRecord | null | undefined,
): SedifexStoreProfile | null => {
  const safeStore = toSafeStoreRecord(profile);
  if (!safeStore?.storeName) return null;

  return {
    storeId: safeStore.storeId,
    storeName: safeStore.storeName,
    storeSlug: safeStore.storeSlug,
    websiteUrl: profile?.promoWebsiteUrl ?? profile?.websiteUrl,
    city: safeStore.city,
    addressLine1: safeStore.addressLine1,
    storePhone: safeStore.phone,
    storeWhatsapp: safeStore.waLink,
    verified: profile?.verified,
  };
};

const normalizeProduct = (product: IntegrationProductRecord): SedifexProduct | null => {
  const id = cleanString(product.id);
  const storeId = cleanString(product.storeId);
  const productName = cleanString(product.productName) ?? cleanString(product.name);

  if (!id || !storeId || !productName) return null;

  const normalizedImageUrls = Array.isArray(product.imageUrls)
    ? product.imageUrls
        .map((url) => cleanString(url))
        .filter((url): url is string => Boolean(url))
    : [];

  const fallbackImageUrl = cleanString(product.imageUrl);

  const imageUrls =
    normalizedImageUrls.length > 0
      ? normalizedImageUrls
      : fallbackImageUrl
        ? [fallbackImageUrl]
        : [];

  const phone = cleanString(product.phone) ?? cleanString(product.storePhone);

  return {
    ...product,
    id,
    storeId,
    storeName: cleanString(product.storeName) ?? '',
    productName,
    categoryKey: cleanString(product.categoryKey) ?? cleanString(product.category),
    city: cleanString(product.city) ?? cleanString(product.storeCity),
    phone,
    waLink: cleanString(product.waLink) ?? phone,
    websiteLink: cleanString(product.websiteLink),
    imageUrls,
    imageAlt: cleanString(product.imageAlt) ?? productName,
    price: typeof product.price === 'number' ? product.price : undefined,
    stockCount: typeof product.stockCount === 'number' ? product.stockCount : undefined,
  };
};

const normalizeProducts = (products: IntegrationProductRecord[]): SedifexProduct[] =>
  products
    .map(normalizeProduct)
    .filter((product): product is SedifexProduct => Boolean(product));

const normalizeCollectionPayload = (
  payload: unknown,
  forcedItemType: 'product' | 'service',
): IntegrationProductRecord[] => {
  if (Array.isArray(payload)) {
    return payload.map((item) => ({ ...(item as IntegrationProductRecord), itemType: forcedItemType }));
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const source = payload as IntegrationProductsPayload & {
    data?: IntegrationProductRecord[];
    list?: IntegrationProductRecord[];
  };

  const items =
    source.publicProducts ??
    source.publicServices ??
    source.items ??
    source.products ??
    source.data ??
    source.list;

  if (Array.isArray(items)) {
    return items.map((item) => ({ ...item, itemType: forcedItemType }));
  }

  const maybeSingle = payload as IntegrationProductRecord;
  const singleId = cleanString(maybeSingle.id) ?? cleanString(maybeSingle.sourceProductId as string | undefined);
  const singleName = cleanString(maybeSingle.productName) ?? cleanString(maybeSingle.name);
  const singleStoreId = cleanString(maybeSingle.storeId);

  if (singleId && singleName && singleStoreId) {
    return [{ ...maybeSingle, itemType: forcedItemType }];
  }

  return [];
};

const extractStoreRecord = (payload: IntegrationStorePayload | null): IntegrationStoreRecord | null => {
  if (!payload) return null;
  if (payload.storeId || payload.id) return payload;
  return payload.store ?? payload.data ?? payload.profile ?? payload.item ?? null;
};

const listVerifiedStoreCatalogItems = async (storeId: string): Promise<IntegrationProductsPayload> => {
  const encodedStoreId = encodeURIComponent(storeId);
  const storePayload = await integrationPublicFetch<IntegrationStorePayload>(`/stores/${encodedStoreId}`).catch(() => null);
  const storeRecord = extractStoreRecord(storePayload);
  const safeStore = toSafeStoreRecord(storeRecord);

  if (!safeStore || safeStore.verified !== true) {
    return {
      storeId,
      publicProducts: [],
      publicServices: [],
      hasMore: false,
    };
  }

  const [productsResponse, servicesResponse] = await Promise.all([
    integrationPublicFetch<unknown>(`/publicProducts/${encodedStoreId}`).catch(() => null),
    integrationPublicFetch<unknown>(`/publicServices/${encodedStoreId}`).catch(() => null),
  ]);

  return {
    storeId,
    publicProducts: normalizeCollectionPayload(productsResponse, 'product'),
    publicServices: normalizeCollectionPayload(servicesResponse, 'service'),
    hasMore: false,
  };
};

const toSafeStoreRecord = (
  store: IntegrationStoreRecord | IntegrationPromoRecord | null | undefined,
): SafeStoreRecord | null => {
  const storeId = cleanString(store?.storeId) ?? cleanString(store?.id);
  if (!storeId || !store) return null;

  const phone =
    cleanString((store as IntegrationStoreRecord).phone) ??
    cleanString((store as IntegrationStoreRecord).storePhone) ??
    cleanString((store as IntegrationPromoRecord).phone);
  const whatsapp =
    cleanString((store as IntegrationStoreRecord).whatsapp) ??
    cleanString((store as IntegrationStoreRecord).whatsappNumber) ??
    cleanString((store as IntegrationPromoRecord).whatsapp) ??
    cleanString((store as IntegrationPromoRecord).whatsappNumber);

  const verifiedStore = (store as IntegrationStoreRecord).verified;
  const verifiedPromo = (store as IntegrationPromoRecord).verified;

  return {
    storeId,
    storeName:
      cleanString((store as IntegrationStoreRecord).displayName) ??
      cleanString(store.name) ??
      cleanString(store.storeName),
    storeSlug:
      cleanString((store as IntegrationStoreRecord).storeSlug) ??
      cleanString((store as IntegrationStoreRecord).workspaceSlug) ??
      cleanString((store as IntegrationPromoRecord).promoSlug),
    city: cleanString(store.city),
    country: cleanString((store as IntegrationStoreRecord).country),
    phone,
    waLink: whatsapp ?? phone,
    addressLine1: cleanString(store.addressLine1),
    verified:
      typeof verifiedStore === 'boolean'
        ? verifiedStore
        : typeof verifiedPromo === 'boolean'
          ? verifiedPromo
          : undefined,
  };
};

const getStoreById = async (storeId: string): Promise<SafeStoreRecord | null> => {
  const normalizedStoreId = storeId.trim();
  if (!normalizedStoreId) return null;

  const encodedStoreId = encodeURIComponent(normalizedStoreId);
  const candidatePaths = [
    `/stores/${encodedStoreId}`,
    `/stores/${encodedStoreId}/store`,
  ];

  for (const endpointPath of candidatePaths) {
    try {
      const payload = await integrationFetch<
        | IntegrationStoreRecord
        | {
            store?: IntegrationStoreRecord | null;
            data?: IntegrationStoreRecord | null;
            profile?: IntegrationStoreRecord | null;
            item?: IntegrationStoreRecord | null;
          }
      >(endpointPath);

      const wrapperPayload = payload as {
        store?: IntegrationStoreRecord | null;
        data?: IntegrationStoreRecord | null;
        profile?: IntegrationStoreRecord | null;
        item?: IntegrationStoreRecord | null;
      };

      const rawStore =
        'storeId' in payload || 'id' in payload
          ? (payload as IntegrationStoreRecord)
          : wrapperPayload.store ??
            wrapperPayload.data ??
            wrapperPayload.profile ??
            wrapperPayload.item ??
            null;

      const safeStore = toSafeStoreRecord(rawStore);
      if (safeStore) return safeStore;
    } catch {
      continue;
    }
  }

  return null;
};

const normalizePromo = (
  promo: IntegrationPromoRecord,
  fallbackStoreId?: string,
): SedifexPromo | null => {
  const storeId = cleanString(promo.storeId) ?? fallbackStoreId;
  const promoTitle = cleanString(promo.promoTitle) ?? cleanString(promo.title);
  const promoSummary =
    cleanString(promo.promoSummary) ??
    cleanString(promo.summary) ??
    cleanString(promo.description);
  const promoImageUrl =
    cleanString(promo.promoImageUrl) ??
    cleanString(promo.imageUrl) ??
    cleanString(promo.image);

  const id =
    cleanString(promo.id) ??
    cleanString(promo.promoId) ??
    (storeId
      ? `${storeId}-${cleanString(promo.promoSlug) ?? promoTitle ?? 'promo'}`
      : undefined);

  if (!id || !storeId) return null;
  if (!promoTitle || !promoSummary || !promoImageUrl) return null;
  if (promo.enabled === false) return null;

  return {
    id,
    storeId,
    storeName:
      cleanString(promo.storeName) ??
      cleanString(promo.displayName) ??
      cleanString(promo.name),
    storeSlug: cleanString(promo.storeSlug) ?? cleanString(promo.promoSlug),
    verified: promo.verified,
    promoTitle,
    promoSummary,
    promoImageUrl,
    promoImageAlt:
      cleanString(promo.promoImageAlt) ??
      cleanString(promo.promoTitle) ??
      cleanString(promo.title) ??
      null,
    promoStartDate:
      cleanString(promo.promoStartDate) ?? cleanString(promo.startDate),
    promoEndDate:
      cleanString(promo.promoEndDate) ?? cleanString(promo.endDate),
    promoWebsiteUrl:
      cleanString(promo.promoWebsiteUrl) ?? cleanString(promo.websiteUrl) ?? null,
    promoTiktokUrl:
      cleanString(promo.promoTiktokUrl) ?? cleanString(promo.tiktokUrl) ?? null,
    promoYoutubeUrl:
      cleanString(promo.promoYoutubeUrl) ?? cleanString(promo.youtubeUrl) ?? null,
  };
};

const normalizePromoPayload = (
  payload: IntegrationPromoPayload,
  fallbackStoreId?: string,
): { items: SedifexPromo[] } => {
  const rawItems = payload.items ?? payload.promos ?? [];
  const single = payload.profile ?? payload.promo;
  const combined = rawItems.length > 0 ? rawItems : single ? [single] : [];

  const items = combined
    .map((item) => normalizePromo(item, fallbackStoreId))
    .filter((item): item is SedifexPromo => Boolean(item));

  return { items };
};

const parseEnvLine = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex <= 0) return;

  const key = trimmed.slice(0, equalsIndex).trim();
  if (!key) return;

  const rawValue = trimmed.slice(equalsIndex + 1).trim();
  const unquoted =
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
      ? rawValue.slice(1, -1)
      : rawValue;

  if (!process.env[key]) {
    process.env[key] = unquoted;
  }
};

const loadBackendIntegrationEnv = () => {
  if (hasLoadedBackendIntegrationEnv) return;
  hasLoadedBackendIntegrationEnv = true;

  for (const envPath of ENV_FILE_LOCATIONS) {
    if (!fs.existsSync(envPath)) continue;

    const file = fs.readFileSync(envPath, 'utf8');
    file.split(/\r?\n/).forEach(parseEnvLine);
    return;
  }
};

const getIntegrationConfig = () => {
  loadBackendIntegrationEnv();

  return {
    baseUrl: process.env.SEDIFEX_INTEGRATION_API_BASE_URL,
    apiKey: process.env.SEDIFEX_INTEGRATION_API_KEY,
    promoSlug: process.env.SEDIFEX_INTEGRATION_PROMO_SLUG,
    contractVersion: process.env.SEDIFEX_INTEGRATION_API_VERSION ?? '2026-04-13',
  };
};

const buildEndpoint = (
  endpointPath: string,
  query?: Record<string, string | number | undefined>,
) => {
  const { baseUrl } = getIntegrationConfig();

  if (!baseUrl) {
    throw new Error('SEDIFEX_INTEGRATION_API_BASE_URL is not configured.');
  }

  const url = new URL(`${baseUrl.replace(/\/$/, '')}${endpointPath}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
};

const integrationFetch = async <T>(
  endpointPath: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> => {
  const { apiKey, contractVersion } = getIntegrationConfig();
  const endpoint = buildEndpoint(endpointPath, query);

  if (!apiKey) {
    throw new Error(
      'SEDIFEX_INTEGRATION_API_KEY is not configured. Set it in your runtime environment.',
    );
  }

  const response = await fetch(endpoint, {
    headers: {
      'x-api-key': apiKey,
      'X-Sedifex-Contract-Version': contractVersion,
      Accept: 'application/json',
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(
      `Sedifex integration request failed (${response.status}) for ${endpoint.pathname}. Check SEDIFEX_INTEGRATION_API_BASE_URL and SEDIFEX_INTEGRATION_API_KEY.`,
    );
  }

  return (await response.json()) as T;
};

const integrationPublicFetch = async <T>(
  endpointPath: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> => {
  const { contractVersion } = getIntegrationConfig();
  const endpoint = buildEndpoint(endpointPath, query);

  const response = await fetch(endpoint, {
    headers: {
      'X-Sedifex-Contract-Version': contractVersion,
      Accept: 'application/json',
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(
      `Sedifex integration request failed (${response.status}) for ${endpoint.pathname}.`,
    );
  }

  return (await response.json()) as T;
};

const getCatalogItems = (payload: IntegrationProductsPayload): SedifexProduct[] => {
  const publicProducts = normalizeProducts(payload.publicProducts ?? []);
  const publicServices = normalizeProducts(payload.publicServices ?? []);

  if (publicProducts.length > 0 || publicServices.length > 0) {
    return [...publicProducts, ...publicServices];
  }

  return normalizeProducts(payload.items ?? payload.products ?? []);
};

const fetchCatalogProducts = async (query?: {
  productId?: string;
  categoryKey?: string;
  storeId?: string;
  promoSlug?: string;
  page?: number;
  pageSize?: number;
  sort?: SedifexProductSort | string;
  maxPerStore?: number;
}) => {
  const { apiKey } = getIntegrationConfig();

  if (apiKey) {
    return integrationFetch<IntegrationProductsPayload>('/v1IntegrationProducts', query);
  }

  if (query?.storeId) {
    return listVerifiedStoreCatalogItems(query.storeId);
  }

  const catalogQuery = {
    storeId: query?.storeId,
    slug: query?.promoSlug,
  };

  if (!catalogQuery.storeId && !catalogQuery.slug) {
    throw new Error(
      'Public catalog access requires storeId or promoSlug when SEDIFEX_INTEGRATION_API_KEY is not configured.',
    );
  }

  return integrationPublicFetch<IntegrationProductsPayload>(
    '/integrationPublicCatalog',
    catalogQuery,
  );
};

export const getIntegrationProductById = async (productId: string) => {
  const payload = await fetchCatalogProducts({ productId });
  return getCatalogItems(payload)[0] ?? null;
};

export const listIntegrationProducts = async (query?: {
  categoryKey?: string;
  storeId?: string;
  promoSlug?: string;
  page?: number;
  pageSize?: number;
  sort?: SedifexProductSort | string;
  maxPerStore?: number;
}) => {
  const payload = await fetchCatalogProducts(query);

  const allItems = getCatalogItems(payload);
  const page = Math.max(1, query?.page ?? 1);
  const fallbackPageSize = allItems.length > 0 ? allItems.length : 1;
  const pageSize = Math.max(1, query?.pageSize ?? fallbackPageSize);

  if (payload.hasMore === undefined) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      items: allItems.slice(start, end),
      hasMore: end < allItems.length,
    };
  }

  return {
    items: allItems,
    hasMore: payload.hasMore,
  };
};

export const listIntegrationCategoryKeys = async () => {
  const { apiKey } = getIntegrationConfig();
  if (!apiKey) return { items: [] as string[] };

  const payload = await fetchCatalogProducts();
  const products = getCatalogItems(payload);
  const categoryKeys = Array.from(
    new Set(products.map((item) => item.categoryKey ?? '').filter(Boolean)),
  );

  return { items: categoryKeys };
};

export const listIntegrationStoreIds = async () => {
  const { apiKey } = getIntegrationConfig();
  if (!apiKey) return { items: [] as string[] };

  const payload = await integrationFetch<IntegrationProductsPayload>(
    '/v1IntegrationProducts',
  );
  const products = getCatalogItems(payload);
  const storeIds = Array.from(
    new Set(products.map((item) => item.storeId).filter(Boolean)),
  );

  return { items: storeIds };
};

export const getIntegrationStoreProfile = async (storeId: string) => {
  const { apiKey, promoSlug } = getIntegrationConfig();
  const [promoPayload, storePayload, productsPayload] = await Promise.all([
    (apiKey
      ? integrationFetch<IntegrationPromoPayload>('/v1IntegrationPromo', {
          storeId,
        })
      : promoSlug
        ? integrationPublicFetch<IntegrationPromoPayload>('/v1IntegrationPromo', {
            slug: promoSlug,
          })
        : Promise.resolve(null)
    ).catch(() => null),
    getStoreById(storeId).catch(() => null),
    fetchCatalogProducts({ storeId, promoSlug }),
  ]);

  const normalizedProducts = getCatalogItems(productsPayload);

  const profileFromPromo = toStoreProfile(promoPayload?.profile ?? promoPayload?.promo);
  const profile: SedifexStoreProfile | null =
    profileFromPromo ??
    (storePayload?.storeName
      ? {
          storeId: storePayload.storeId,
          storeName: storePayload.storeName,
          storeSlug: storePayload.storeSlug,
          city: storePayload.city,
          country: storePayload.country,
          addressLine1: storePayload.addressLine1,
          storePhone: storePayload.phone,
          storeWhatsapp: storePayload.waLink,
          verified: storePayload.verified,
        }
      : null);

  return {
    profile,
    products: normalizedProducts,
  };
};

export const listIntegrationPromos = async () => {
  const { apiKey, promoSlug } = getIntegrationConfig();
  if (!apiKey) {
    if (!promoSlug) return { items: [] as SedifexPromo[] };
    try {
      const payload = await integrationPublicFetch<IntegrationPromoPayload>(
        '/v1IntegrationPromo',
        { slug: promoSlug },
      );
      return normalizePromoPayload(payload);
    } catch {
      return { items: [] as SedifexPromo[] };
    }
  }

  const { items: storeIds } = await listIntegrationStoreIds();
  if (storeIds.length === 0) {
    return { items: [] as SedifexPromo[] };
  }

  const promoResponses = await Promise.all(
    storeIds.map(async (storeId) => {
      try {
        const payload = await integrationFetch<IntegrationPromoPayload>(
          '/v1IntegrationPromo',
          { storeId },
        );
        return normalizePromoPayload(payload, storeId).items;
      } catch {
        return [];
      }
    }),
  );

  const deduped = Array.from(
    new Map(promoResponses.flat().map((promo) => [promo.id, promo])).values(),
  );

  return { items: deduped };
};

export const listIntegrationGallery = async (storeId?: string) => {
  const payload = await integrationFetch<{ items?: SedifexGalleryItem[] }>(
    '/integrationGallery',
    storeId ? { storeId } : undefined,
  );

  return { items: payload.items ?? [] };
};

export const listIntegrationCustomers = async (storeId?: string) => {
  const payload = await integrationFetch<{ items?: SedifexCustomer[] }>(
    '/integrationCustomers',
    storeId ? { storeId } : undefined,
  );

  return { items: payload.items ?? [] };
};
