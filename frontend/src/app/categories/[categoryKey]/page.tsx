import type { Metadata } from 'next';
import Link from 'next/link';
import { getProductsByCategory } from '@/lib/public-stores';
import { canonicalUrlForPath } from '@/lib/seo';

type CategoryPageProps = {
  params: { categoryKey: string };
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const canonical = canonicalUrlForPath(`/categories/${params.categoryKey}`);
  return {
    title: `${params.categoryKey} products`,
    description: `Browse ${params.categoryKey} products from verified stores on Sedifex.`,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      title: `${params.categoryKey} products | Sedifex`,
      description: `Browse ${params.categoryKey} products from verified stores on Sedifex.`,
      siteName: 'Sedifex',
    },
  };
}

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
