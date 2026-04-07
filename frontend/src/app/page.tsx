import { ProductGrid } from '@/components/product-grid';

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
          <p className="eyebrow">Modern Product Marketplace</p>
          <h1>Shop clean, curated collections</h1>
          <p>Find what you need fast with smart filters and direct WhatsApp checkout.</p>
          <div className="heroHighlights">
            <span>Fast search</span>
            <span>Verified stores</span>
            <span>Direct chat</span>
          </div>
        </div>
      </header>
      <ProductGrid />
    </main>
  );
}
