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
  products?: IntegrationProductRecord[];
  items?: IntegrationProductRecord[];
  hasMore?: boolean;
};

type IntegrationProductRecord = Partial<SedifexProduct> & {
  id?: string;
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

const toSafeStoreRecord = (
  store: IntegrationStoreRecord | IntegrationPromoRecord | null | undefined,
): SafeStoreRecord | null => {
  const storeId = cleanString(store?.storeId) ?? cleanString(store?.id);
  if (!storeId) return null;

  const phone = cleanString(store.phone) ?? cleanString(store.storePhone);
  const whatsapp =
    cleanString((store as IntegrationStoreRecord).whatsapp) ??
    cleanString((store as IntegrationStoreRecord).whatsappNumber) ??
    cleanString((store as IntegrationPromoRecord).whatsapp) ??
    cleanString((store as IntegrationPromoRecord).whatsappNumber);

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
      typeof (store as IntegrationStoreRecord).verified === 'boolean'
        ? (store as IntegrationStoreRecord).verified
        : typeof (store as IntegrationPromoRecord).verified === 'boolean'
          ? (store as IntegrationPromoRecord).verified
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

      const rawStore =
        'storeId' in payload || 'id' in payload
          ? (payload as IntegrationStoreRecord)
          : payload.store ?? payload.data ?? payload.profile ?? payload.item ?? null;

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

export const getIntegrationProductById = async (productId: string) => {
  const payload = await integrationFetch<IntegrationProductsPayload>(
    '/v1IntegrationProducts',
    { productId },
  );

  const products = payload.products ?? payload.items ?? [];
  return normalizeProducts(products)[0] ?? null;
};

export const listIntegrationProducts = async (query?: {
  categoryKey?: string;
  storeId?: string;
  page?: number;
  pageSize?: number;
  sort?: SedifexProductSort | string;
  maxPerStore?: number;
}) => {
  const payload = await integrationFetch<IntegrationProductsPayload>(
    '/v1IntegrationProducts',
    query,
  );

  const allItems = normalizeProducts(payload.items ?? payload.products ?? []);
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
  const payload = await integrationFetch<IntegrationProductsPayload>(
    '/v1IntegrationProducts',
  );

  const products = normalizeProducts(payload.products ?? payload.items ?? []);
  const categoryKeys = Array.from(
    new Set(products.map((item) => item.categoryKey ?? '').filter(Boolean)),
  );

  return { items: categoryKeys };
};

export const listIntegrationStoreIds = async () => {
  const payload = await integrationFetch<IntegrationProductsPayload>(
    '/v1IntegrationProducts',
  );

  const products = normalizeProducts(payload.products ?? payload.items ?? []);
  const storeIds = Array.from(
    new Set(products.map((item) => item.storeId).filter(Boolean)),
  );

  return { items: storeIds };
};

export const getIntegrationStoreProfile = async (storeId: string) => {
  const [promoPayload, storePayload, productsPayload] = await Promise.all([
    integrationFetch<IntegrationPromoPayload>('/v1IntegrationPromo', {
      storeId,
    }).catch(() => null),
    getStoreById(storeId).catch(() => null),
    integrationFetch<IntegrationProductsPayload>('/v1IntegrationProducts', {
      storeId,
    }),
  ]);

  const normalizedProducts = normalizeProducts(
    productsPayload.products ?? productsPayload.items ?? [],
  );

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
