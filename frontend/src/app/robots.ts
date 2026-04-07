import type { MetadataRoute } from 'next';
import { canonicalUrlForPath } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/'],
    },
    sitemap: canonicalUrlForPath('/sitemap.xml'),
    host: canonicalUrlForPath('/'),
  };
}
