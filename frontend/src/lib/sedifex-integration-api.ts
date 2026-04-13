import type {
  SedifexCustomer,
  SedifexGalleryItem,
  SedifexProduct,
  SedifexProductSort,
  SedifexPromo,
  SedifexStoreProfile,
} from '@sedifex/integration-types';

const baseUrl = process.env.SEDIFEX_INTEGRATION_API_BASE_URL;
const apiKey = process.env.SEDIFEX_INTEGRATION_API_KEY;
const apiVersion = process.env.SEDIFEX_INTEGRATION_API_VERSION ?? 'v1';

const buildEndpoint = (path: string, query?: Record<string, string | number | undefined>) => {
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
  const endpoint = buildEndpoint(path, query);
  const response = await fetch(endpoint, {
    headers: apiKey ? { 'x-api-key': apiKey } : undefined,
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Sedifex integration request failed (${response.status}) for ${endpoint.pathname}`);
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
