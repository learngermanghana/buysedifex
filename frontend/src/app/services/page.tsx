import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Services from local stores on Sedifex';
const description =
  'Discover stores that offer services instead of physical products and contact them directly on Sedifex.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/services'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/services'),
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

export default function ServicesPage() {
  return (
    <main className="container">
      <section className="searchPageIntro">
        <p className="eyebrow">Services</p>
        <h1>Available services on Sedifex</h1>
        <p>
          This page shows listings where <strong>item type = service</strong>, helping customers discover stores that
          provide services.
        </p>
      </section>

      <ProductGrid itemTypeFilter="service" />

      <div className="inlineLinks">
        <Link href="/add-product">How stores can add a product</Link>
        <Link href="/contact">Report a concern or enquiry</Link>
      </div>
    </main>
  );
}
