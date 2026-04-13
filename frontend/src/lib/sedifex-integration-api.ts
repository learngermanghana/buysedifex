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
  name?: string;
  category?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  price?: number;
  stockCount?: number;
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

const cleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeProduct = (product: IntegrationProductRecord): SedifexProduct | null => {
  const id = cleanString(product.id);
  const storeId = cleanString(product.storeId);
  const storeName = cleanString(product.storeName);
  const normalizedStoreName = storeName ?? '';
  const productName = cleanString(product.productName) || cleanString(product.name);

  // storeName is optional for all-store marketplace responses
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

  return {
    ...product,
    id,
    storeId,
    storeName: normalizedStoreName,
    productName,
    categoryKey: cleanString(product.categoryKey) ?? cleanString(product.category),
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

const toSafeStoreRecord = (store: IntegrationStoreRecord | null | undefined): SafeStoreRecord | null => {
  const storeId = cleanString(store?.storeId) ?? cleanString(store?.id);
  if (!store || !storeId) return null;

  const phone = cleanString(store.phone) ?? cleanString(store.storePhone);
  const city = cleanString(store.city);
  const country = cleanString(store.country);
  const addressLine1 = cleanString(store.addressLine1);
  const storeName = cleanString(store.displayName) || cleanString(store.name) || cleanString(store.storeName);
  const whatsapp = cleanString(store.whatsapp) || cleanString(store.whatsappNumber);

  return {
    storeId,
    storeName: storeName ?? undefined,
    storeSlug: cleanString(store.storeSlug) ?? cleanString(store.workspaceSlug),
    city: city ?? undefined,
    country: country ?? undefined,
    phone: phone ?? undefined,
    waLink: whatsapp ?? phone ?? undefined,
    addressLine1: addressLine1 ?? undefined,
  };
};

const getStoreById = async (storeId: string): Promise<SafeStoreRecord | null> => {
  const normalizedStoreId = storeId.trim();
  if (!normalizedStoreId) return null;

  const resolveStorePayload = async () => {
    const encodedStoreId = encodeURIComponent(normalizedStoreId);
    const paths = ['/stores/' + encodedStoreId, '/stores/' + encodedStoreId + '/store'];

    for (const endpointPath of paths) {
      try {
        const storePayload = await integrationFetch<{
          store?: IntegrationStoreRecord | null;
          data?: IntegrationStoreRecord | null;
          profile?: IntegrationStoreRecord | null;
          item?: IntegrationStoreRecord | null;
        }>(endpointPath);

        const safeStore = toSafeStoreRecord(storePayload.store ?? storePayload.data ?? storePayload.profile ?? storePayload.item);
        if (safeStore) return safeStore;
      } catch {
        continue;
      }
    }

    return null;
  };

  const storeFromStoreEndpoint = await resolveStorePayload();

  try {
    const payload = await integrationFetch<IntegrationPromoPayload>('/v1IntegrationPromo', {
      storeId: normalizedStoreId,
    });
    const fromPromo = toSafeStoreRecord(payload.profile ?? payload.promo ?? payload.items?.[0] ?? payload.promos?.[0]);

    if (!storeFromStoreEndpoint) {
      return fromPromo;
    }

    return {
      ...fromPromo,
      ...storeFromStoreEndpoint,
      storeId: storeFromStoreEndpoint.storeId,
      storeName: storeFromStoreEndpoint.storeName ?? fromPromo?.storeName,
      storeSlug: storeFromStoreEndpoint.storeSlug ?? fromPromo?.storeSlug,
      city: storeFromStoreEndpoint.city ?? fromPromo?.city,
      country: storeFromStoreEndpoint.country ?? fromPromo?.country,
      phone: storeFromStoreEndpoint.phone ?? fromPromo?.phone,
      waLink: storeFromStoreEndpoint.phone ?? fromPromo?.waLink,
      addressLine1: storeFromStoreEndpoint.addressLine1 ?? fromPromo?.addressLine1,
    };
  } catch {
    return storeFromStoreEndpoint;
  }
};

const normalizePromo = (
  promo: IntegrationPromoRecord,
  fallbackStoreId?: string,
): SedifexPromo | null => {
  const storeId = cleanString(promo.storeId) ?? fallbackStoreId;
  const id =
    cleanString(promo.id) ??
    cleanString(promo.promoId) ??
    (storeId ? `${storeId}-${cleanString(promo.promoSlug) ?? cleanString(promo.promoTitle) ?? 'promo'}` : undefined);

  if (!id) return null;

  return {
    id,
    storeId,
    storeName: cleanString(promo.storeName) ?? cleanString(promo.displayName) ?? cleanString(promo.name),
    storeSlug: cleanString(promo.storeSlug) ?? cleanString(promo.promoSlug),
    verified: promo.verified,
    promoTitle: cleanString(promo.promoTitle) ?? cleanString(promo.title),
    promoSummary: cleanString(promo.promoSummary) ?? cleanString(promo.summary) ?? cleanString(promo.description),
    promoImageUrl: cleanString(promo.promoImageUrl) ?? cleanString(promo.imageUrl) ?? cleanString(promo.image),
    promoImageAlt: cleanString(promo.promoImageAlt) ?? cleanString(promo.promoTitle) ?? cleanString(promo.title) ?? null,
    promoStartDate: cleanString(promo.promoStartDate) ?? cleanString(promo.startDate),
    promoEndDate: cleanString(promo.promoEndDate) ?? cleanString(promo.endDate),
    promoWebsiteUrl: cleanString(promo.promoWebsiteUrl) ?? cleanString(promo.websiteUrl) ?? null,
    promoTiktokUrl: cleanString(promo.promoTiktokUrl) ?? cleanString(promo.tiktokUrl) ?? null,
    promoYoutubeUrl: cleanString(promo.promoYoutubeUrl) ?? cleanString(promo.youtubeUrl) ?? null,
  };
};

const normalizePromoPayload = (
  payload: IntegrationPromoPayload,
  fallbackStoreId?: string,
) => {
  const rawItems = payload.items ?? payload.promos ?? [];
  const single = payload.profile ?? payload.promo;
  const combined = rawItems.length > 0 ? rawItems : single ? [single] : [];
  const items = combined
    .filter((item) => item.enabled !== false)
    .map((item) => normalizePromo(item, fallbackStoreId))
    .filter((item): item is SedifexPromo => Boolean(item));
  return { items };
};

const enrichProductsWithStoreData = async (
  products: SedifexProduct[],
): Promise<SedifexProduct[]> => {
  const uniqueStoreIds = Array.from(
    new Set(products.map((product) => product.storeId?.trim()).filter(Boolean)),
  );

  const storeEntries = await Promise.all(
    uniqueStoreIds.map(async (storeId) => [storeId, await getStoreById(storeId)] as const),
  );

  const storeLookup = new Map<string, SafeStoreRecord | null>(storeEntries);

  return products.map((product) => {
    const safeStore = storeLookup.get(product.storeId);

    if (!safeStore) {
      return product;
    }

    return {
      ...product,
      storeName: safeStore.storeName ?? product.storeName,
      city: safeStore.city ?? product.city,
      country: safeStore.country ?? product.country,
      waLink: safeStore.waLink ?? product.waLink,
      phone: safeStore.phone ?? product.phone,
      addressLine1: safeStore.addressLine1 ?? product.addressLine1,
    };
  });
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
  const normalizedProduct = normalizeProducts(products)[0] ?? null;
  if (!normalizedProduct) return null;

  const enriched = await enrichProductsWithStoreData([normalizedProduct]);
  return enriched[0] ?? normalizedProduct;
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

  const normalizedItems = normalizeProducts(payload.items ?? payload.products ?? []);
  const allItems = await enrichProductsWithStoreData(normalizedItems);
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

  const normalizedProducts = normalizeProducts(productsPayload.products ?? productsPayload.items ?? []);
  const enrichedProducts = await enrichProductsWithStoreData(normalizedProducts);
  const profileFromPromo = toStoreProfile(promoPayload?.profile ?? promoPayload?.promo);
  const profile: SedifexStoreProfile | null = profileFromPromo ?? (storePayload?.storeName
    ? {
        storeId: storePayload.storeId,
        storeName: storePayload.storeName,
        storeSlug: storePayload.storeSlug,
        city: storePayload.city,
        country: storePayload.country,
        addressLine1: storePayload.addressLine1,
        storePhone: storePayload.phone,
        storeWhatsapp: storePayload.waLink,
      }
    : null);

  return {
    profile,
    products: enrichedProducts,
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
        const payload = await integrationFetch<IntegrationPromoPayload>('/v1IntegrationPromo', { storeId });
        return normalizePromoPayload(payload, storeId).items;
      } catch {
        return [];
      }
    }),
  );

  const deduped = Array.from(
    new Map(
      promoResponses.flat().map((promo) => [promo.id, promo]),
    ).values(),
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
