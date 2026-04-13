import type { SedifexProduct } from '@sedifex/integration-types';
import { getIntegrationProductById, listIntegrationProducts } from '@/lib/sedifex-integration-api';

export type PublicProductDetail = SedifexProduct;

const normalizeRouteId = (value: string): string => {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
};

export const getPublicProductById = async (productId: string): Promise<PublicProductDetail | null> => {
  const normalizedProductId = normalizeRouteId(productId);
  if (!normalizedProductId) return null;
  return getIntegrationProductById(normalizedProductId);
};

export const listPublicProductIds = async (limitCount = 200): Promise<string[]> => {
  const response = await listIntegrationProducts({ page: 1, pageSize: limitCount, sort: 'newest' });
  return response.items.map((item) => item.id).filter(Boolean);
};
