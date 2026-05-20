import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Sedifex Market';
const description = 'Shop products, services, and courses from trusted local stores in Ghana.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('products ghana', 'services ghana', 'courses ghana'),
  alternates: { canonical: canonicalUrlForPath('/') },
  openGraph: { type: 'website', url: canonicalUrlForPath('/'), title, description, siteName: 'Sedifex', images: [{ url: defaultSocialImageUrl() }] },
  twitter: { card: 'summary_large_image', title, description, images: [defaultSocialImageUrl()] },
};

export default function HomePage() {
  return (
    <main className="container marketHomePage">
      <section className="commerceHero" aria-label="Sedifex Market introduction">
        <div className="commerceHeroContent">
          <p className="eyebrow">Sedifex Market Deals</p>
          <h1>Shop trusted Ghana stores with bright deals and secure checkout.</h1>
          <p>Find products, services, and courses from verified sellers. Add to cart, pay securely, and keep your order record on Sedifex.</p>
          <div className="heroActions">
            <Link href="/products" className="btn btnPrimary">Shop Products</Link>
            <Link href="/services" className="btn btnSecondary">Book Services</Link>
            <Link href="/courses" className="btn btnGhost">Explore Courses</Link>
          </div>
        </div>
        <div className="commerceHeroVisual" aria-hidden="true">
          <span className="dealChip dealChipTop">Verified stores</span>
          <span className="dealChip dealChipRight">Secure checkout</span>
          <span className="dealChip dealChipBottom">Ghana marketplace</span>
          <div className="salesBurst"><span>Fresh</span><strong>Deals</strong></div>
        </div>
      </section>

      <section className="marketSectionIntro">
        <p className="eyebrow">Start shopping</p>
        <h2>Products</h2>
      </section>
      <ProductGrid itemTypeFilter="product" />

      <section className="marketSectionIntro">
        <p className="eyebrow">Book trusted providers</p>
        <h2>Services</h2>
      </section>
      <ProductGrid itemTypeFilter="service" />

      <section className="marketSectionIntro">
        <p className="eyebrow">Learn and register</p>
        <h2>Courses</h2>
      </section>
      <ProductGrid itemTypeFilter="course" />
    </main>
  );
}
