import type {
  SedifexCustomer,
  SedifexGalleryItem,
  SedifexProduct,
  SedifexProductSort,
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
  name?: string;
  category?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  price?: number;
  stockCount?: number;
};

type IntegrationPromoProfile = {
  id?: string;
  storeId?: string;
  storeName?: string;
  storeSlug?: string;
  verified?: boolean;
  displayName?: string;
  name?: string;
  promoTitle?: string;
  promoSummary?: string;
  promoStartDate?: string;
  promoEndDate?: string;
  promoSlug?: string;
  promoWebsiteUrl?: string;
};

type IntegrationPromoPayload = {
  items?: IntegrationPromoProfile[];
  promos?: IntegrationPromoProfile[];
  profile?: IntegrationPromoProfile | null;
  promo?: IntegrationPromoProfile | null;
};

const toStoreProfile = (profile: IntegrationPromoProfile | null | undefined): SedifexStoreProfile | null => {
  if (!profile) return null;

  const storeId = profile.storeId ?? profile.id ?? '';
  const storeName = profile.storeName ?? profile.displayName ?? profile.name ?? '';
  if (!storeId || !storeName) return null;

  return {
    storeId,
    storeName,
    storeSlug: profile.storeSlug ?? profile.promoSlug,
    websiteUrl: profile.promoWebsiteUrl,
    verified: profile.verified,
  };
};

const normalizeProduct = (product: IntegrationProductRecord): SedifexProduct | null => {
  const id = product.id?.trim();
  const storeId = product.storeId?.trim();
  const productName = product.productName?.trim() || product.name?.trim();

  if (!id || !storeId || !productName) return null;

  const normalizedImageUrls = Array.isArray(product.imageUrls)
    ? product.imageUrls.map((url) => url?.trim()).filter((url): url is string => Boolean(url))
    : [];
  const fallbackImageUrl = product.imageUrl?.trim();
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
    productName,
    categoryKey: product.categoryKey ?? product.category ?? undefined,
    imageUrls,
    price: typeof product.price === 'number' ? product.price : undefined,
    stockCount: typeof product.stockCount === 'number' ? product.stockCount : undefined,
  };
};

const normalizeProducts = (products: IntegrationProductRecord[]): SedifexProduct[] =>
  products.map(normalizeProduct).filter((product): product is SedifexProduct => Boolean(product));

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
    new Set(
      products
        .map((item) => item.categoryKey ?? '')
        .filter(Boolean),
    ),
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
  const [promoPayload, productPayload] = await Promise.all([
    integrationFetch<IntegrationPromoPayload>('/v1IntegrationPromo', {
      storeId,
    }).catch(() => null),
    integrationFetch<IntegrationProductsPayload>('/v1IntegrationProducts', {
      storeId,
    }),
  ]);

  return {
    profile: toStoreProfile(promoPayload?.profile ?? promoPayload?.promo),
    products: normalizeProducts(productPayload.products ?? productPayload.items ?? []),
  };
};

export const listIntegrationPromos = async () => {
  const payload = await integrationFetch<IntegrationPromoPayload>(
    '/v1IntegrationPromo',
  );

  return {
    items: payload.items ?? payload.promos ?? (payload.profile ? [payload.profile] : []),
  };
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
