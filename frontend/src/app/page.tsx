import type { Metadata } from 'next';
import Link from 'next/link';
import { HomeAdFlash } from '@/components/home-ad-flash';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';
import './home-market.css';

const title = 'Sedifex Market | Shop Products in Ghana';
const description = 'Shop products from trusted local stores in Ghana with clear seller details, secure checkout, delivery options, and Sedifex receipts.';

const shoppingCategories = [
  { label: 'Beauty', href: '/category/Beauty' },
  { label: 'Skin Care', href: '/category/Skin%20care' },
  { label: 'Hair Care', href: '/category/Hair%20care' },
  { label: 'Fashion', href: '/category/Fashion' },
  { label: 'Groceries', href: '/category/Groceries' },
  { label: 'Baby Care', href: '/category/Baby%20care' },
  { label: 'Supplements', href: '/category/Supplements' },
];

const trustItems = [
  { title: 'Fast delivery', text: 'Same-day where available, otherwise next-day or pickup.' },
  { title: 'Secure checkout', text: 'Your order and receipt stay recorded on Sedifex.' },
  { title: 'Trusted stores', text: 'See the seller and store details before you pay.' },
  { title: 'Customer support', text: 'Get help when you need it before or after checkout.' },
];

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('products ghana', 'online shopping ghana', 'ghana marketplace', 'secure checkout ghana'),
  alternates: { canonical: canonicalUrlForPath('/') },
  openGraph: { type: 'website', url: canonicalUrlForPath('/'), title, description, siteName: 'Sedifex', images: [{ url: defaultSocialImageUrl() }] },
  twitter: { card: 'summary_large_image', title, description, images: [defaultSocialImageUrl()] },
};

export default function HomePage() {
  return (
    <main className="container marketHomePage retailHomePage">
      <section className="retailTopGrid" aria-label="Sedifex shopping overview">
        <aside className="retailCategoryMenu" aria-label="Product categories">
          <div className="retailCategoryTitle">Shop by category</div>
          <nav>
            {shoppingCategories.map((category) => (
              <Link key={category.label} href={category.href}>
                <span>{category.label}</span>
                <span aria-hidden="true">›</span>
              </Link>
            ))}
            <Link className="retailCategoryAll" href="/categories">
              <span>All categories</span>
              <span aria-hidden="true">›</span>
            </Link>
          </nav>
        </aside>

        <section className="retailHero" aria-label="Sedifex Market deals">
          <div className="retailHeroCopy">
            <p className="retailHeroEyebrow">Sedifex Market</p>
            <h1>Everything you need, from Ghana stores you can trust.</h1>
            <p>Discover everyday products, new arrivals and local deals. Shop with clear seller details, delivery options and secure checkout.</p>
            <div className="retailHeroActions">
              <Link href="/products" className="retailPrimaryAction">Shop now</Link>
              <Link href="/categories" className="retailSecondaryAction">Browse categories</Link>
            </div>
          </div>
          <div className="retailHeroDeal" aria-hidden="true">
            <span>SHOP</span>
            <strong>LOCAL</strong>
            <small>Better discovery. Easier checkout.</small>
          </div>
        </section>

        <aside className="retailPromoStack" aria-label="Shopping benefits">
          <Link href="/products" className="retailPromoCard retailPromoHot">
            <span>Today&apos;s picks</span>
            <strong>Fresh products</strong>
            <small>See what&apos;s new</small>
          </Link>
          <Link href="/stores" className="retailPromoCard">
            <span>Buy local</span>
            <strong>Trusted stores</strong>
            <small>Meet the sellers</small>
          </Link>
          <Link href="/sell" className="retailPromoCard">
            <span>For merchants</span>
            <strong>Sell on Sedifex</strong>
            <small>List your products</small>
          </Link>
        </aside>
      </section>

      <section className="retailQuickLinks" aria-label="Popular shopping categories">
        {shoppingCategories.map((category) => (
          <Link key={category.label} href={category.href}>
            <span className="retailQuickIcon" aria-hidden="true">{category.label.slice(0, 1)}</span>
            <strong>{category.label}</strong>
          </Link>
        ))}
      </section>

      <HomeAdFlash />

      <section className="retailSectionHeader retailSectionHeaderHot">
        <div>
          <span>Hot right now</span>
          <h2>Featured products</h2>
        </div>
        <Link href="/products">See all products →</Link>
      </section>
      <ProductGrid itemTypeFilter="product" previewLimit={12} showToolbar={false} showPagination={false} moreHref="/products" moreLabel="See all products" />

      <section className="retailTrustStrip" aria-label="Why shop on Sedifex">
        {trustItems.map((item) => (
          <div key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
          </div>
        ))}
      </section>

      <section className="retailSectionHeader">
        <div>
          <span>Keep shopping</span>
          <h2>More products for you</h2>
        </div>
        <Link href="/products">Open full catalogue →</Link>
      </section>
      <ProductGrid itemTypeFilter="product" previewLimit={24} showToolbar={false} showPagination={false} moreHref="/products" moreLabel="Open full catalogue" />
    </main>
  );
}
