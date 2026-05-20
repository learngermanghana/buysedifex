import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Products on Sedifex Market';
const description = 'Browse products from verified Sedifex stores.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('products ghana', 'shop products sedifex'),
  alternates: { canonical: canonicalUrlForPath('/products') },
  openGraph: { type: 'website', url: canonicalUrlForPath('/products'), title, description, siteName: 'Sedifex', images: [{ url: defaultSocialImageUrl() }] },
  twitter: { card: 'summary_large_image', title, description, images: [defaultSocialImageUrl()] },
};

export default function ProductsPage() {
  return <main className="container"><ProductGrid itemTypeFilter="product" /></main>;
}
