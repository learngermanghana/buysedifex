import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildCategoryPath, formatCategoryName } from '@/lib/category';
import { getAllCategoryKeys, getProductsByCategoryPage } from '@/lib/public-stores';

type CategoryPageProps = {
  params: { categoryKey: string };
  searchParams?: { page?: string };
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://buy.sedifex.com';
const PAGE_SIZE = 24;

const getValidPage = (page?: string): number => {
  const parsed = Number(page);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
};

export async function generateStaticParams() {
  const categories = await getAllCategoryKeys();
  return categories.map((categoryKey) => ({ categoryKey }));
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const categoryName = formatCategoryName(params.categoryKey);
  const page = getValidPage(searchParams?.page);
  const canonicalPath = buildCategoryPath(params.categoryKey);
  const canonicalUrl = new URL(canonicalPath, siteUrl);

  if (page > 1) {
    canonicalUrl.searchParams.set('page', String(page));
  }

  return {
    title: `Buy ${categoryName} in Ghana | Sedifex`,
    description: `Browse ${categoryName} products from verified stores on Sedifex. Order directly via WhatsApp.`,
    alternates: { canonical: canonicalUrl.toString() },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const page = getValidPage(searchParams?.page);
  const categoryName = formatCategoryName(params.categoryKey);
  const { products, hasMore } = await getProductsByCategoryPage(params.categoryKey, page, PAGE_SIZE);

  if (products.length === 0) {
    notFound();
  }

  const canonicalPath = buildCategoryPath(params.categoryKey);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: (page - 1) * PAGE_SIZE + index + 1,
      url: new URL(`/products/${encodeURIComponent(product.id)}`, siteUrl).toString(),
      name: product.productName,
    })),
  };

  return (
    <main className="hero" style={{ maxWidth: 920 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="eyebrow">Category</p>
      <h1>{categoryName}</h1>
      <p>Shop verified {categoryName} products and order directly on WhatsApp.</p>

      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <Link href={`/products/${encodeURIComponent(product.id)}`}>{product.productName}</Link>
            {' by '}
            {product.storeId ? <Link href={`/stores/${encodeURIComponent(product.storeId)}`}>{product.storeName}</Link> : product.storeName}
          </li>
        ))}
      </ul>

      <nav aria-label="Category pagination" style={{ display: 'flex', gap: 16 }}>
        {page > 1 ? (
          <Link href={page === 2 ? canonicalPath : `${canonicalPath}?page=${page - 1}`} rel="prev">
            Previous page
          </Link>
        ) : (
          <span />
        )}
        {hasMore ? (
          <Link href={`${canonicalPath}?page=${page + 1}`} rel="next">
            Next page
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
