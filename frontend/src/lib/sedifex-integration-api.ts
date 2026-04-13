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
  const payload = await integrationFetch<{ products?: SedifexProduct[] }>(
    '/v1IntegrationProducts',
    { productId },
  );
  return payload.products?.[0] ?? null;
};

export const listIntegrationProducts = (query?: {
  categoryKey?: string;
  storeId?: string;
  page?: number;
  pageSize?: number;
  sort?: SedifexProductSort | string;
  maxPerStore?: number;
}) =>
  integrationFetch<{ products: SedifexProduct[]; items?: SedifexProduct[]; hasMore?: boolean }>(
    '/v1IntegrationProducts',
    query,
  ).then((payload) => ({
    items: payload.items ?? payload.products ?? [],
    hasMore: payload.hasMore ?? false,
  }));

export const listIntegrationCategoryKeys = async () => {
  const payload = await integrationFetch<{ products?: SedifexProduct[] }>(
    '/v1IntegrationProducts',
  );

  const products = payload.products ?? [];
  const categoryKeys = Array.from(
    new Set(
      products
        .map((item: any) => item.categoryKey ?? item.category ?? '')
        .filter(Boolean),
    ),
  );

  return { items: categoryKeys };
};

export const listIntegrationStoreIds = async () => {
  const payload = await integrationFetch<{ products?: SedifexProduct[] }>(
    '/v1IntegrationProducts',
  );

  const products = payload.products ?? [];
  const storeIds = Array.from(
    new Set(products.map((item: any) => item.storeId).filter(Boolean)),
  );

  return { items: storeIds };
};

export const getIntegrationStoreProfile = async (storeId: string) => {
  const [promoPayload, productPayload] = await Promise.all([
    integrationFetch<any>('/v1IntegrationPromo', { storeId }).catch(() => null),
    integrationFetch<{ products?: SedifexProduct[] }>('/v1IntegrationProducts', { storeId }),
  ]);

  return {
    profile: promoPayload?.profile ?? promoPayload?.promo ?? null,
    products: productPayload.products ?? [],
  };
};

export const listIntegrationPromos = async () => {
  const payload = await integrationFetch<any>('/v1IntegrationPromo');
  return { items: payload.items ?? payload.promos ?? (payload ? [payload] : []) };
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
