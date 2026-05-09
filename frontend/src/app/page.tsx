import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
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
          <div className="heroActions">
            <Link href="/stores" className="btn btnPrimary">
              Browse stores
            </Link>
            <Link href="/search" className="btn btnSecondary">
              Advanced search
            </Link>
            <Link href="/sell" className="btn btnGhost">
              Start selling
            </Link>
          </div>
          <div className="heroHighlights">
            <span>🏪 Pick a verified store first</span>
            <span>🔎 Search within that store</span>
            <span>📦 Discover categories faster</span>
          </div>
          <p className="heroMeta">
            Learn more <Link href="/about">about Sedifex</Link> or <Link href="/contact">contact support</Link>.
          </p>
        </div>
      </header>

      <section className="featureRow" aria-label="Shopping benefits">
        <article className="featureCard">
          <h2>Verified storefronts</h2>
          <p>Discover sellers with clear store profiles before browsing items.</p>
        </article>
        <article className="featureCard">
          <h2>Store-first discovery</h2>
          <p>Search inside a selected store so results are faster and more relevant.</p>
        </article>
        <article className="featureCard">
          <h2>Direct WhatsApp contact</h2>
          <p>Chat with sellers instantly to confirm stock, delivery, and price updates.</p>
        </article>
      </section>

      <div className="homeColumns">
        <div className="productsColumn">
          <ProductGrid />
        </div>
      </div>
    </main>
  );
}
