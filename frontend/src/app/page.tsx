import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Sedifex Market';
const description = 'Shop products from trusted local stores in Ghana with clear seller details, secure checkout, support, delivery, and return policy information.';

const trustCards = [
  {
    title: 'Transparent marketplace',
    text: 'Sedifex Market connects customers with verified Ghana stores. Each listing shows the seller, price, category, and checkout options before you buy.',
  },
  {
    title: 'Secure checkout records',
    text: 'Orders are tracked through Sedifex, with payment confirmation and receipts kept for customer and seller reference.',
  },
  {
    title: 'Customer support',
    text: 'Need help before or after purchase? Contact Sedifex Market by WhatsApp, phone, or email from any page.',
  },
];

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('products ghana', 'online shopping ghana', 'verified stores ghana', 'secure checkout ghana'),
  alternates: { canonical: canonicalUrlForPath('/') },
  openGraph: { type: 'website', url: canonicalUrlForPath('/'), title, description, siteName: 'Sedifex', images: [{ url: defaultSocialImageUrl() }] },
  twitter: { card: 'summary_large_image', title, description, images: [defaultSocialImageUrl()] },
};

const trustPanelStyle = {
  display: 'grid',
  gap: '1rem',
  borderRadius: '1.1rem',
  padding: 'clamp(1rem, 2.4vw, 1.45rem)',
  background: '#ffffff',
  border: '1px solid #d7e0ea',
  boxShadow: '0 18px 36px -30px rgba(15,23,42,.8)',
} as const;

const trustGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '.85rem',
} as const;

const trustCardStyle = {
  borderRadius: '.95rem',
  padding: '.95rem',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
} as const;

const policyLinksStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '.65rem',
  alignItems: 'center',
} as const;

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

      <section style={trustPanelStyle} aria-label="Sedifex Market trust and policy information">
        <div>
          <p className="eyebrow" style={{ color: '#047857' }}>Shop with clarity</p>
          <h2 style={{ margin: '.25rem 0 0' }}>Who you are buying from and how orders work</h2>
          <p style={{ margin: '.45rem 0 0', color: '#475569', maxWidth: 860 }}>
            Sedifex Market is operated from Accra, Ghana. We help customers discover products from local sellers and complete checkout with visible support, delivery, return, and refund information.
          </p>
        </div>
        <div style={trustGridStyle}>
          {trustCards.map((card) => (
            <article key={card.title} style={trustCardStyle}>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>{card.title}</h3>
              <p style={{ margin: '.4rem 0 0', color: '#475569', lineHeight: 1.55 }}>{card.text}</p>
            </article>
          ))}
        </div>
        <div style={policyLinksStyle} aria-label="Important customer policy links">
          <Link href="/about" className="btn btnSecondary">About Sedifex Market</Link>
          <Link href="/contact" className="btn btnSecondary">Contact support</Link>
          <Link href="/return-policy" className="btn btnGhost">Return & refund policy</Link>
          <Link href="/shipping-delivery-policy" className="btn btnGhost">Shipping & delivery policy</Link>
        </div>
      </section>

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
