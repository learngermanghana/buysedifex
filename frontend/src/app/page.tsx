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

const trendingCategories = [
  'Skincare & Beauty',
  'Phones & Accessories',
  'Fashion Deals',
  'Home Essentials',
  'Health & Wellness',
  'Groceries',
];

export default function HomePage() {
  return (
    <main className="container">
      <section className="commerceHero" aria-label="Professional shopping hero">
        <div className="commerceHeroContent">
          <p className="eyebrow">Sedifex Marketplace</p>
          <h1>Shop smarter with trusted stores, fast deals, and verified sellers.</h1>
          <p>
            Inspired by leading marketplaces, Sedifex gives you a professional shopping experience with store-first
            discovery, real-time chat, and secure order confidence.
          </p>
          <div className="heroActions">
            <Link href="/search" className="btn btnPrimary">
              Search products
            </Link>
            <Link href="/stores" className="btn btnPrimary">
              Shop by store
            </Link>
            <Link href="/categories" className="btn btnSecondary">
              Explore categories
            </Link>
            <Link href="/sell" className="btn btnGhost">
              Become a seller
            </Link>
            <Link href="/about" className="btn btnGhost">
              About Sedifex
            </Link>
            <Link href="/contact" className="btn btnGhost">
              Contact us
            </Link>
          </div>
        </div>
        <div className="commerceHeroVisual" role="img" aria-label="Modern ecommerce showcase with featured products" />
      </section>

      <section className="quickLinksStrip" aria-label="Trending categories">
        {trendingCategories.map((category) => (
          <Link key={category} href="/categories" className="quickLinkChip">
            {category}
          </Link>
        ))}
      </section>

      <section className="promoGrid" aria-label="Marketplace promotional banners">
        <article className="promoCard promoCardLarge">
          <div>
            <p className="promoLabel">Mega Sale</p>
            <h2>Up to 50% off top products this week</h2>
            <p>Discover limited-time offers from verified stores across beauty, electronics, and home essentials.</p>
            <Link href="/products" className="promoLink">
              View flash deals →
            </Link>
          </div>
        </article>
        <article className="promoCard promoCardBeauty">
          <p className="promoLabel">Beauty Spotlight</p>
          <h2>New arrivals in skincare & cosmetics</h2>
          <Link href="/category/beauty" className="promoLink">
            Shop beauty →
          </Link>
        </article>
        <article className="promoCard promoCardElectro">
          <p className="promoLabel">Tech Picks</p>
          <h2>Mobile accessories and smart gadgets</h2>
          <Link href="/category/electronics" className="promoLink">
            Shop electronics →
          </Link>
        </article>
      </section>

      <section className="featureRow" aria-label="Shopping benefits">
        <article className="featureCard">
          <h2>Verified storefronts</h2>
          <p>Every listing starts with a transparent seller profile so you can shop with confidence.</p>
        </article>
        <article className="featureCard">
          <h2>Store-first search</h2>
          <p>Find relevant products faster by browsing inside the stores you trust most.</p>
        </article>
        <article className="featureCard">
          <h2>Instant WhatsApp support</h2>
          <p>Chat directly with sellers to confirm stock, delivery windows, and latest pricing.</p>
        </article>
        <article className="featureCard">
          <h2>Professional deal discovery</h2>
          <p>Browse curated promos, trending categories, and featured products in one clean homepage.</p>
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
