import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { SectionTabs } from '@/components/section-tabs';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Sedifex Marketplace | Products and Services';
const description =
  'Browse products and services on Sedifex. Discover trusted businesses, featured listings, and contact providers quickly.';

export const metadata: Metadata = {
  title,
  description,
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
          aria-label="Sedifex marketplace products and service providers"
        />
        <div className="heroContent">
          <p className="eyebrow">Sedifex Marketplace</p>
          <h1>Discover trusted local stores near you</h1>
          <p><strong>Find products and services from trusted businesses.</strong></p>
          <p>Search instantly, compare options, and contact sellers or providers in one place.</p>
          <form className="heroSearch" role="search">
            <input
              type="search"
              placeholder="Search products, services, businesses, or categories"
              aria-label="Search products and services"
            />
            <select aria-label="Choose location" defaultValue="Accra">
              <option>Accra</option>
              <option>Kumasi</option>
              <option>Takoradi</option>
              <option>Tamale</option>
            </select>
          </form>
          <div className="inlineLinks" aria-label="Browse marketplace sections">
            <Link href="/products">Browse Products</Link>
            <Link href="/services">Browse Services</Link>
            <Link href="/search">Hero search</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/sell">Sell</Link>
          </div>
        </div>
      </header>

      <section className="quickSections" aria-label="Homepage sections">
        <p>Featured Products</p>
        <p>Featured Services</p>
        <p>Popular Categories</p>
        <p>Trusted Businesses</p>
        <p>How Sedifex Works</p>
      </section>

      <section aria-label="Featured products">
        <ProductGrid />
      </section>

      <section className="infoPage">
        <h2>How Sedifex Works</h2>
        <ol>
          <li>Browse products or services.</li>
          <li>Open the detail page and review business information.</li>
          <li>Use the CTA that matches your goal: chat, request, quote, or booking.</li>
        </ol>
      </section>
    </main>
  );
}
