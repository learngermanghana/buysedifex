import type { MetadataRoute } from 'next';
import { listPublicProductIds } from '@/lib/public-products';
import { listPublicCategoryKeys, listPublicStoreIds } from '@/lib/public-stores';
import { canonicalUrlForPath } from '@/lib/seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productIds, storeIds, categoryKeys] = await Promise.all([
    listPublicProductIds(),
    listPublicStoreIds(),
    listPublicCategoryKeys(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: canonicalUrlForPath('/'), changeFrequency: 'daily', priority: 1 },
    { url: canonicalUrlForPath('/about'), changeFrequency: 'weekly', priority: 0.6 },
    { url: canonicalUrlForPath('/sell'), changeFrequency: 'weekly', priority: 0.7 },
    { url: canonicalUrlForPath('/contact'), changeFrequency: 'weekly', priority: 0.6 },
    { url: canonicalUrlForPath('/privacy'), changeFrequency: 'monthly', priority: 0.4 },
    { url: canonicalUrlForPath('/terms'), changeFrequency: 'monthly', priority: 0.4 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categoryKeys.map((categoryKey) => ({
    url: canonicalUrlForPath(`/category/${encodeURIComponent(categoryKey)}`),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

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

  return [...staticRoutes, ...categoryRoutes, ...storeRoutes, ...productRoutes];
}
