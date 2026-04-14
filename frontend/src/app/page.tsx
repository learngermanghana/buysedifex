import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { PromoCarousel } from '@/components/promo-carousel';
import { SectionTabs } from '@/components/section-tabs';
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
      <SectionTabs activeTab="products" />
      <header className="hero">
        <div
          className="heroImage"
          role="img"
          aria-label="Minimal shopping setup with products staged for online browsing"
        />
        <div className="heroContent">
          <p className="eyebrow">Sedifex Market</p>
          <h1>Discover trusted local stores near you</h1>
          <p>Search products, compare prices, and contact verified stores in seconds.</p>
          <form className="heroSearch" role="search">
            <input type="search" placeholder="Search products, stores, or categories" aria-label="Search products and stores" />
            <select aria-label="Choose location" defaultValue="Accra">
              <option>Accra</option>
              <option>Kumasi</option>
              <option>Takoradi</option>
              <option>Tamale</option>
            </select>
          </form>
          <div className="heroHighlights">
            <span>🔥 Featured products</span>
            <span>🏪 Top stores near you</span>
            <span>📦 Categories</span>
          </div>
          <nav className="inlineLinks" aria-label="Sedifex information pages">
            <Link href="/search">Search &amp; Filter</Link>
            <Link href="/about">About</Link>
            <Link href="/services">Services</Link>
            <Link href="/sell">Sell on Sedifex</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </header>
      <section className="quickSections" aria-label="Homepage discovery sections">
        <p>Trending in Accra</p>
        <p>Recently added</p>
        <p>Best priced</p>
      </section>
      <div className="homeColumns">
        <PromoCarousel />
        <div className="productsColumn">
          <ProductGrid />
        </div>
      </div>
    </main>
  );
}
