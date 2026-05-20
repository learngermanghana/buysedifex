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
    <main className="container">
      <section className="commerceHero" aria-label="Sedifex Market introduction">
        <div className="commerceHeroContent"><p className="eyebrow">Sedifex Market</p><h1>Products, Services, and Courses</h1>
        <div className="heroActions"><Link href="/products" className="btn btnPrimary">Products</Link><Link href="/services" className="btn btnSecondary">Services</Link><Link href="/courses" className="btn btnGhost">Courses</Link></div></div>
      </section>
      <h2>Products</h2><ProductGrid itemTypeFilter="product" />
      <h2>Services</h2><ProductGrid itemTypeFilter="service" />
      <h2>Courses</h2><ProductGrid itemTypeFilter="course" />
    </main>
  );
}
