import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { CANONICAL_CATEGORY_KEYS } from '@/lib/category-taxonomy';
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
      <section className="commerceHero" aria-label="Professional shopping hero">
        <div className="commerceHeroContent">
          <p className="eyebrow">Sedifex Marketplace</p>
          <h1>Search all products quickly, then refine as our catalog grows.</h1>
          <p>
            We are still expanding inventory, so search is now more general across all stores. Use categories for
            discovery—even if some are still being filled with products.
          </p>
          <div className="heroActions">
            <Link href="/search" className="btn btnPrimary">
              Search all products
            </Link>
            <Link href="/categories" className="btn btnSecondary">
              Browse all categories
            </Link>
            <Link href="/stores" className="btn btnGhost">
              View stores
            </Link>
          </div>
        </div>
        <div className="commerceHeroVisual" role="img" aria-label="Modern ecommerce showcase with featured products" />
      </section>

      <section className="categoriesShowcase" aria-label="Homepage categories showcase">
        <div className="categoriesHeader">
          <h2>Shop by category</h2>
          <p>Some categories may be empty for now. Check back often as new products are added daily.</p>
        </div>
        <div className="categoriesGrid">
          {CANONICAL_CATEGORY_KEYS.map((category) => (
            <Link href={`/category/${encodeURIComponent(category)}`} className="categoryCard" key={category}>
              <h3>{category}</h3>
              <p>Explore {category.toLowerCase()} listings</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="featureRow" aria-label="Shopping benefits">
        <article className="featureCard">
          <h2>General search first</h2>
          <p>Find available products across stores in one place without strict store-by-store filtering.</p>
        </article>
        <article className="featureCard">
          <h2>Category-led browsing</h2>
          <p>Jump into the type of products you need and discover new listings as inventory grows.</p>
        </article>
        <article className="featureCard">
          <h2>Instant WhatsApp support</h2>
          <p>Chat directly with sellers to confirm stock, delivery windows, and latest pricing.</p>
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
