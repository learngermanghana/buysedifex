import Link from 'next/link';
import { getProductsByCategory } from '@/lib/public-stores';

type CategoryPageProps = {
  params: { categoryKey: string };
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const products = await getProductsByCategory(params.categoryKey);

  return (
    <main className="hero" style={{ maxWidth: 920 }}>
      <p className="eyebrow">Category</p>
      <h1>{params.categoryKey}</h1>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <Link href={`/products/${encodeURIComponent(product.id)}`}>{product.productName}</Link>
            {' by '}
            {product.storeName}
          </li>
        ))}
      </ul>
    </main>
  );
}
