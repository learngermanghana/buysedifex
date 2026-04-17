import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { PromoCarousel } from '@/components/promo-carousel';
import { getStoreHref } from '@/lib/store-route';
import { getStoreProfileById, listPublicStoreIds } from '@/lib/public-stores';
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

const describeStore = (categories: string[]) => {
  if (categories.length === 0) {
    return 'Browse products from this verified store.';
  }

  if (categories.length === 1) {
    return `Specializes in ${categories[0]}.`;
  }

  if (categories.length === 2) {
    return `Offers ${categories[0]} and ${categories[1]}.`;
  }

  return `Offers ${categories.slice(0, 2).join(', ')}, and more.`;
};

export default async function HomePage() {
  const storeIds = await listPublicStoreIds().catch(() => []);
  const storeProfiles = (
    await Promise.all(
      storeIds.slice(0, 12).map(async (storeId) => ({
        storeId,
        profile: await getStoreProfileById(storeId),
      })),
    )
  )
    .flatMap(({ storeId, profile }) => {
      if (!profile || !profile.verified) return [];

      const categories = Array.from(
        new Set(profile.products.map((product) => product.categoryKey?.trim()).filter((category): category is string => Boolean(category))),
      ).slice(0, 3);

      return [
        {
          id: storeId,
          name: profile.storeName,
          categories,
          productCount: profile.products.length,
        },
      ];
    })
    .slice(0, 6);

  return (
    <main className="container">
      <header className="hero">
        <div
          className="heroImage"
          role="img"
          aria-label="Minimal shopping setup with products staged for online browsing"
        />
        <div className="heroContent">
          <p className="eyebrow">Sedifex Market</p>
          <h1>Discover trusted local stores near you</h1>
          <p>Start by opening a verified store, then search only inside that store for better product results.</p>
          <p>
            Need filters? <Link href="/search">Use advanced search</Link>.
          </p>
          <p>
            Learn more <Link href="/about">about Sedifex</Link>.
          </p>
          <p>
            Looking for providers? <Link href="/services">Browse services</Link>.
          </p>
          <p>
            Store owner? <Link href="/sell">Start selling</Link>.
          </p>
          <p>
            Need help? <Link href="/contact">Contact support</Link>.
          </p>
          <div className="heroHighlights">
            <span>🏪 Pick a verified store first</span>
            <span>🔎 Search within that store</span>
            <span>📦 Discover categories faster</span>
          </div>
        </div>
      </header>

      <section className="storeShowcase" aria-label="Verified stores on Sedifex">
        <div className="storeShowcaseHeader">
          <p className="eyebrow">Verified Stores</p>
          <h2>Choose a store, then shop inside it</h2>
          <p>Open a store page to search through that store&apos;s products and avoid mixed listings.</p>
        </div>
        <div className="storeShowcaseGrid">
          {storeProfiles.map((store) => (
            (() => {
              const storeHref = getStoreHref(store.id, store.name) ?? '/stores';

              return (
                <article key={store.id} className="storeShowcaseCard">
                  <h3>{store.name}</h3>
                  <p>{describeStore(store.categories)}</p>
                  <p className="storeShowcaseMeta">
                    {store.productCount > 0
                      ? `${store.productCount} active listing${store.productCount === 1 ? '' : 's'}`
                      : 'Listings coming soon'}
                  </p>
                  <Link href={storeHref} className="storeShowcaseLink">
                    Open store
                  </Link>
                </article>
              );
            })()
          ))}
        </div>
        <p className="storeShowcaseFooter">
          Want more options? <Link href="/stores">Browse all verified stores</Link>.
        </p>
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
