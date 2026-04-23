import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { PromoCarousel } from '@/components/promo-carousel';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Discover trusted local stores near you';
const description =
  'Discover trusted local stores across Ghana, compare prices, and connect with sellers instantly on WhatsApp.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('beauty products ghana', 'buy beauty products online', 'ghana stores online'),
  alternates: {
    canonical: canonicalUrlForPath('/'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/'),
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

export default function HomePage() {
  return (
    <main className="container">
      <header className="hero">
        <div
          className="heroImage"
          role="img"
          aria-label="Minimal shopping setup with products staged for online browsing"
        />
        <div className="heroContent">
          <p className="eyebrow">Sedifex Market</p>
          <h1>Discover trusted local stores near you</h1>
          <p>Start by opening a verified store, then search only inside that store for better product results.</p>
          <p>
            Need filters? <Link href="/search">Use advanced search</Link>.
          </p>
          <p>
            Learn more <Link href="/about">about Sedifex</Link>.
          </p>
          <p>
            Store owner? <Link href="/sell">Start selling</Link>.
          </p>
          <p>
            Need help? <Link href="/contact">Contact support</Link>.
          </p>
          <div className="heroHighlights">
            <span>🏪 Pick a verified store first</span>
            <span>🔎 Search within that store</span>
            <span>📦 Discover categories faster</span>
          </div>
        </div>
      </header>

      <div className="homeColumns">
        <PromoCarousel />
        <div className="productsColumn">
          <ProductGrid />
        </div>
      </div>
    </main>
  );
}
