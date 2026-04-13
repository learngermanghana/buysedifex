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
    apiVersion: process.env.SEDIFEX_INTEGRATION_API_VERSION ?? 'v1',
  };
};

const buildEndpoint = (path: string, query?: Record<string, string | number | undefined>) => {
  const { baseUrl, apiVersion } = getIntegrationConfig();

  if (!baseUrl) {
    throw new Error('SEDIFEX_INTEGRATION_API_BASE_URL is not configured.');
  }

  const url = new URL(`${baseUrl.replace(/\/$/, '')}/${apiVersion}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });

  return url;
};

const integrationFetch = async <T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> => {
  const { apiKey } = getIntegrationConfig();
  const endpoint = buildEndpoint(path, query);

  if (!apiKey) {
    throw new Error('SEDIFEX_INTEGRATION_API_KEY is not configured. Set it in your runtime environment (for example Vercel Project Settings → Environment Variables).');
  }

  const response = await fetch(endpoint, {
    headers: { 'x-api-key': apiKey },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Sedifex integration request failed (${response.status}) for ${endpoint.pathname}. Verify SEDIFEX_INTEGRATION_API_BASE_URL, SEDIFEX_INTEGRATION_API_VERSION, and SEDIFEX_INTEGRATION_API_KEY.`);
  }

  return (await response.json()) as T;
};

export const getIntegrationProductById = (productId: string) => integrationFetch<SedifexProduct | null>(`/products/${encodeURIComponent(productId)}`);

export const listIntegrationProducts = (query?: {
  categoryKey?: string;
  storeId?: string;
  page?: number;
  pageSize?: number;
  sort?: SedifexProductSort | string;
  maxPerStore?: number;
}) => integrationFetch<{ items: SedifexProduct[]; hasMore: boolean }>(`/products`, query);

export const listIntegrationCategoryKeys = () => integrationFetch<{ items: string[] }>(`/categories`);

export const listIntegrationStoreIds = () => integrationFetch<{ items: string[] }>(`/stores/ids`);

export const getIntegrationStoreProfile = (storeId: string) =>
  integrationFetch<{ profile: SedifexStoreProfile | null; products: SedifexProduct[] }>(`/stores/${encodeURIComponent(storeId)}`);

export const listIntegrationPromos = () => integrationFetch<{ items: SedifexPromo[] }>(`/promos`, { limit: 10 });
export const listIntegrationGallery = () => integrationFetch<{ items: SedifexGalleryItem[] }>(`/gallery`);
export const listIntegrationCustomers = () => integrationFetch<{ items: SedifexCustomer[] }>(`/customers`);
