import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Services on Sedifex Market';
const description = 'Discover services from verified Sedifex providers.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('services ghana', 'book services sedifex'),
  alternates: { canonical: canonicalUrlForPath('/services') },
  openGraph: { type: 'website', url: canonicalUrlForPath('/services'), title, description, siteName: 'Sedifex', images: [{ url: defaultSocialImageUrl() }] },
  twitter: { card: 'summary_large_image', title, description, images: [defaultSocialImageUrl()] },
};

export default function ServicesPage() {
  return <main className="container"><ProductGrid itemTypeFilter="service" /></main>;
}
