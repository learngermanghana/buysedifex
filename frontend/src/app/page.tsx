import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Promote and shop businesses in Ghana';
const description =
  'Sedifex helps Ghanaian businesses promote products online and connect with customers through WhatsApp.';

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
      <header className="hero">
        <div
          className="heroImage"
          role="img"
          aria-label="Minimal shopping setup with products staged for online browsing"
        />
        <div className="heroContent">
          <p className="eyebrow">Ghana Business Promotion Platform</p>
          <h1>Discover and promote businesses across Ghana</h1>
          <p>Use Sedifex to showcase products, reach local customers, and close sales fast with direct WhatsApp contact.</p>
          <div className="heroHighlights">
            <span>Built for Ghana</span>
            <span>Promote your store</span>
            <span>Direct customer contact</span>
          </div>
        </div>
      </header>
      <ProductGrid />
    </main>
  );
}
