import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { SectionTabs } from '@/components/section-tabs';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Products on Sedifex';
const description = 'Browse products from trusted Sedifex businesses and connect with sellers quickly.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/products'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/products'),
    title,
    description,
    siteName: 'Sedifex',
    images: [{ url: defaultSocialImageUrl() }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [defaultSocialImageUrl()],
  },
};

export default function ProductsPage() {
  return (
    <main className="container">
      <SectionTabs activeTab="products" />
      <section className="homeSection">
        <p className="eyebrow">Products</p>
        <h1>Browse Products</h1>
      </section>
      <ProductGrid />
    </main>
  );
}
