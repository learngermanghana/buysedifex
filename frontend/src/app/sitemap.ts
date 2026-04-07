import type { MetadataRoute } from 'next';
import { listPublicProductIds } from '@/lib/public-products';
import { listPublicStoreIds } from '@/lib/public-stores';
import { canonicalUrlForPath } from '@/lib/seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productIds, storeIds] = await Promise.all([listPublicProductIds(), listPublicStoreIds()]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: canonicalUrlForPath('/'), changeFrequency: 'daily', priority: 1 },
  ];

  const productRoutes: MetadataRoute.Sitemap = productIds.map((id) => ({
    url: canonicalUrlForPath(`/products/${encodeURIComponent(id)}`),
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const storeRoutes: MetadataRoute.Sitemap = storeIds.map((id) => ({
    url: canonicalUrlForPath(`/stores/${encodeURIComponent(id)}`),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  return [...staticRoutes, ...storeRoutes, ...productRoutes];
}
