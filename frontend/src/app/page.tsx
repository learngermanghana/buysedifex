import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { canonicalUrlForPath } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Promote and shop businesses in Ghana',
  description: 'Sedifex helps Ghanaian businesses promote products online and connect with customers through WhatsApp.',
  alternates: {
    canonical: canonicalUrlForPath('/'),
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
