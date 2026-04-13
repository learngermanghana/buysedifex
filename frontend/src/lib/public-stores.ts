import type { SedifexStoreProfile } from '@sedifex/integration-types';
import type { PublicProductDetail } from '@/lib/public-products';
import {
  getIntegrationStoreProfile,
  listIntegrationCategoryKeys,
  listIntegrationProducts,
  listIntegrationStoreIds,
} from '@/lib/sedifex-integration-api';

export type StoreProfile = SedifexStoreProfile & {
  products: PublicProductDetail[];
  sameAs: string[];
  verified: boolean;
};

export type CategoryProductPage = {
  products: PublicProductDetail[];
  hasMore: boolean;
};

const normalizeRouteId = (value: string): string => {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
};

export const getStoreProfileById = async (storeId: string): Promise<StoreProfile | null> => {
  const normalizedStoreId = normalizeRouteId(storeId);
  if (!normalizedStoreId) return null;

  const { profile, products } = await getIntegrationStoreProfile(normalizedStoreId);
  if (!profile) return null;

  return {
    ...profile,
    products,
    sameAs: profile.sameAs ?? [],
    verified: Boolean(profile.verified),
  };
};

export const getProductsByCategory = async (
  categoryKey: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<CategoryProductPage> => {
  if (!categoryKey) {
    return { products: [], hasMore: false };
  }

  const response = await listIntegrationProducts({
    categoryKey,
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 24,
    sort: 'newest',
  });

  return { products: response.items, hasMore: response.hasMore };
};

export const listPublicCategoryKeys = async (): Promise<string[]> => {
  const response = await listIntegrationCategoryKeys();
  return response.items;
};

export const listPublicStoreIds = async (): Promise<string[]> => {
  const response = await listIntegrationStoreIds();
  return response.items;
};
