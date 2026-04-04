import { ProductGrid } from '@/components/product-grid';

export default function HomePage() {
  return (
    <main className="container">
      <header>
        <h1>buy.sedifex.com</h1>
        <p>
          Browse publicly visible products generated from <code>publicProducts</code> in Firestore.
        </p>
      </header>
      <ProductGrid />
    </main>
  );
}
