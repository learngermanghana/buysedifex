import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeAdFlash } from '@/components/home-ad-flash';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Sedifex Market';
const description = 'Shop products from trusted local stores in Ghana with clear seller details, secure checkout, support, delivery, and return policy information.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('products ghana', 'online shopping ghana', 'verified stores ghana', 'secure checkout ghana'),
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
          <p>Find products from verified sellers. View the product details, add to cart, pay securely, and keep your order record on Sedifex.</p>
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

      <HomeAdFlash />

      <section className="marketSectionIntro">
        <div>
          <p className="eyebrow">Start shopping</p>
          <h2>Products</h2>
        </div>
        <Link href="/products">Open more products</Link>
      </section>
      <ProductGrid itemTypeFilter="product" previewLimit={8} showToolbar={false} showPagination={false} moreHref="/products" moreLabel="Open more products" />

      <section className="marketSectionIntro">
        <div>
          <p className="eyebrow">Book trusted providers</p>
          <h2>Services</h2>
        </div>
        <Link href="/services">Open more services</Link>
      </section>
      <ProductGrid itemTypeFilter="service" previewLimit={8} showToolbar={false} showPagination={false} moreHref="/services" moreLabel="Open more services" />

      <section className="marketSectionIntro">
        <div>
          <p className="eyebrow">Learn and register</p>
          <h2>Courses</h2>
        </div>
        <Link href="/courses">Open more courses</Link>
      </section>
      <ProductGrid itemTypeFilter="course" previewLimit={8} showToolbar={false} showPagination={false} moreHref="/courses" moreLabel="Open more courses" />
    </main>
  );
}
