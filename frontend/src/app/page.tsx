import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeProductGrid } from '@/components/home-product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Sedifex Market | Shop trusted local stores in Ghana';
const description =
  'Shop products from trusted local stores across Ghana, compare prices, and connect with sellers instantly on Sedifex Market.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('buy products online ghana', 'ghana stores online', 'trusted local stores ghana'),
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
      <section className="commerceHero" aria-label="Sedifex Market introduction">
        <div className="commerceHeroContent">
          <p className="eyebrow">Sedifex Market</p>
          <h1>Shop products from trusted local stores in Ghana.</h1>
          <p>
            Search products, compare prices, open store pages, and complete checkout directly through Sedifex.
          </p>
          <div className="heroActions">
            <Link href="/stores" className="btn btnPrimary">Shop by store</Link>
            <Link href="/categories" className="btn btnSecondary">Browse categories</Link>
            <Link href="/sell" className="btn btnGhost">Become a seller</Link>
          </div>
        </div>
      </section>

      <div className="homeColumns">
        <div className="productsColumn">
          <HomeProductGrid />
        </div>
      </div>

      <section className="darkCommerceSection" aria-label="Sell on Sedifex Market">
        <div>
          <p className="eyebrow">For store owners</p>
          <h2>Want your products on Sedifex Market?</h2>
          <p>List your store, sync your inventory, and reach buyers from one Sedifex dashboard.</p>
        </div>
        <Link href="/sell" className="btn btnPrimary">Become a seller</Link>
      </section>
    </main>
  );
}
