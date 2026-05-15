import type { Metadata } from 'next';
import Link from 'next/link';
import { ServiceMarketGrid } from '@/components/service-market-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Services on Sedifex Market | Book verified local services in Ghana';
const description = 'Discover and book services from verified local stores and service providers on Sedifex Market.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('book services online ghana', 'verified service providers ghana', 'beauty spa school services ghana'),
  alternates: { canonical: canonicalUrlForPath('/services') },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/services'),
    title,
    description,
    siteName: 'Sedifex Market',
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
      <section className="commerceHero" aria-label="Sedifex Market services introduction">
        <div className="commerceHeroContent">
          <p className="eyebrow">Sedifex Services</p>
          <h1>Book services from verified local businesses.</h1>
          <p>
            Browse beauty, training, professional, and local services from verified Sedifex stores. Choose a service, submit your details, and pay online when available.
          </p>
          <div className="heroActions">
            <Link href="/" className="btn btnSecondary">Shop products</Link>
            <Link href="/stores" className="btn btnPrimary">Browse stores</Link>
          </div>
        </div>
      </section>

      <ServiceMarketGrid />
    </main>
  );
}
