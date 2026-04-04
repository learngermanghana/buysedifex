import { ProductGrid } from '@/components/product-grid';

export default function HomePage() {
  return (
    <main className="container">
      <header className="hero">
        <div
          className="heroImage"
          role="img"
          aria-label="Colorful shopping scene with bags and accessories"
        />
        <div className="heroContent">
          <p className="eyebrow">Modern Product Marketplace</p>
          <h1>Discover curated products from trusted stores</h1>
          <p>
            Explore featured listings, filter by category, search instantly, and contact sellers directly through
            WhatsApp.
          </p>
        </div>
      </header>
      <ProductGrid />
    </main>
  );
}
