import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { SectionTabs } from '@/components/section-tabs';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Products on Sedifex';
const description = 'Browse featured products from trusted businesses on Sedifex.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: canonicalUrlForPath('/products') },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/products'),
    title,
    description,
    siteName: 'Sedifex',
    images: [{ url: defaultSocialImageUrl() }],
  },
};

export default function ProductsPage() {
  return (
    <main className="container">
      <SectionTabs activeTab="products" />
      <p className="eyebrow">Products</p>
      <h1>Browse products</h1>
      <ProductGrid />
    </main>
  );
}
