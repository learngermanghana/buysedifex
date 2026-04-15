import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Products from trusted local stores';
const description = 'Browse verified products from local stores, compare pricing, and contact sellers quickly on Sedifex.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('products ghana', 'local store products', 'buy online ghana products'),
  alternates: { canonical: canonicalUrlForPath('/products') },
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
      <section className="searchPageIntro">
        <p className="eyebrow">Products</p>
        <h1>Find products fast</h1>
        <p>Browse product listings from verified stores and connect on WhatsApp for quick enquiries.</p>
      </section>
      <ProductGrid itemTypeFilter="product" />
    </main>
  );
}
