import type { MetadataRoute } from 'next';
import { getProductHref } from '@/lib/product-route';
import { listPublicProductSitemapEntries } from '@/lib/public-products';
import { listPublicCategoryKeys, listPublicStoreIds } from '@/lib/public-stores';
import { canonicalUrlForPath } from '@/lib/seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, storeIds, categoryKeys] = await Promise.all([
    listPublicProductSitemapEntries(1000).catch(() => []),
    listPublicStoreIds(500).catch(() => []),
    listPublicCategoryKeys().catch(() => []),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: canonicalUrlForPath('/'), changeFrequency: 'daily', priority: 1 },
    { url: canonicalUrlForPath('/stores'), changeFrequency: 'daily', priority: 0.9 },
    { url: canonicalUrlForPath('/products'), changeFrequency: 'daily', priority: 0.9 },
    { url: canonicalUrlForPath('/services'), changeFrequency: 'daily', priority: 0.9 },
    { url: canonicalUrlForPath('/courses'), changeFrequency: 'daily', priority: 0.9 },
    { url: canonicalUrlForPath('/category'), changeFrequency: 'weekly', priority: 0.75 },
    { url: canonicalUrlForPath('/search'), changeFrequency: 'daily', priority: 0.85 },
    { url: canonicalUrlForPath('/sell'), changeFrequency: 'weekly', priority: 0.7 },
    { url: canonicalUrlForPath('/about'), changeFrequency: 'weekly', priority: 0.6 },
    { url: canonicalUrlForPath('/contact'), changeFrequency: 'weekly', priority: 0.6 },
    { url: canonicalUrlForPath('/privacy'), changeFrequency: 'monthly', priority: 0.3 },
    { url: canonicalUrlForPath('/return-policy'), changeFrequency: 'monthly', priority: 0.3 },
    { url: canonicalUrlForPath('/shipping-delivery-policy'), changeFrequency: 'monthly', priority: 0.3 },
    { url: canonicalUrlForPath('/terms'), changeFrequency: 'monthly', priority: 0.3 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categoryKeys.map((categoryKey) => ({
    url: canonicalUrlForPath(`/category/${encodeURIComponent(categoryKey)}`),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: canonicalUrlForPath(getProductHref(product.id, product.productName, product.listingType)),
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const storeRoutes: MetadataRoute.Sitemap = storeIds.map((id) => ({
    url: canonicalUrlForPath(`/stores/${encodeURIComponent(id)}`),
    changeFrequency: 'daily',
    priority: 0.85,
  }));

  return [...staticRoutes, ...categoryRoutes, ...storeRoutes, ...productRoutes];
}
