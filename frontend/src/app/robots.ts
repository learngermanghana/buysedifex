import type { MetadataRoute } from 'next';
import { canonicalUrlForPath, getSiteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/account/', '/checkout/', '/admin/', '/login/', '/cart/'],
      },
    ],
    sitemap: canonicalUrlForPath('/sitemap.xml'),
    host: getSiteUrl(),
  };
}
