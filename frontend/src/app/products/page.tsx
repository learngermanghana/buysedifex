import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Buy Products Online in Ghana | Verified Stores | Sedifex Market';
const description =
  'Shop products from verified Ghana stores on Sedifex Market. Find skincare, beauty, fashion, health, and everyday products with seller details, delivery options, secure checkout, and instant receipts.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords(
    'buy products online in ghana',
    'verified stores in accra',
    'skincare products ghana',
    'beauty products ghana',
    'fashion products ghana',
    'health products ghana',
    'secure checkout ghana',
  ),
  alternates: { canonical: canonicalUrlForPath('/products') },
  openGraph: { type: 'website', url: canonicalUrlForPath('/products'), title, description, siteName: 'Sedifex', images: [{ url: defaultSocialImageUrl() }] },
  twitter: { card: 'summary_large_image', title, description, images: [defaultSocialImageUrl()] },
};

export default function ProductsPage() {
  return (
    <main className="container">
      <section className="marketSectionIntro" aria-label="Products marketplace introduction">
        <div>
          <p className="eyebrow">Verified Ghana stores</p>
          <h1>Buy products online in Ghana from verified Sedifex stores</h1>
          <p>
            Shop skincare, beauty, fashion, health, and everyday products from trusted sellers in Accra
            and across Ghana. Compare product details, seller information, delivery options, secure checkout,
            and instant receipts before you order on Sedifex Market.
          </p>
        </div>
      </section>
      <ProductGrid itemTypeFilter="product" />
    </main>
  );
}
