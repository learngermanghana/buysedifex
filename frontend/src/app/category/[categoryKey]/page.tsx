import type { Metadata } from 'next';
import Link from 'next/link';
import { getProductsByCategory, listPublicCategoryKeys } from '@/lib/public-stores';
import { buildSeoKeywords, canonicalUrlForPath, categoryNameFromKey, defaultSocialImageUrl } from '@/lib/seo';

type CategoryPageProps = {
  params: { categoryKey: string };
  searchParams?: { page?: string };
};

const PAGE_SIZE = 24;

const parsePage = (pageParam?: string) => {
  const parsed = Number.parseInt(pageParam ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export async function generateStaticParams() {
  const categoryKeys = await listPublicCategoryKeys();
  return categoryKeys.map((categoryKey) => ({ categoryKey }));
}

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const categoryName = categoryNameFromKey(params.categoryKey) || params.categoryKey;
  const page = parsePage(searchParams?.page);
  const canonicalPath = page > 1 ? `/category/${params.categoryKey}?page=${page}` : `/category/${params.categoryKey}`;
  const canonical = canonicalUrlForPath(canonicalPath);
  const title = `Buy ${categoryName} in Ghana | Sedifex`;
  const description = `Browse ${categoryName} products from verified stores on Sedifex. Order directly via WhatsApp.`;

  return {
    title,
    description,
    keywords: buildSeoKeywords(`${categoryName} in ghana`, `buy ${categoryName.toLowerCase()} online ghana`),
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
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
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const page = parsePage(searchParams?.page);
  const { products, hasMore } = await getProductsByCategory(params.categoryKey, { page, pageSize: PAGE_SIZE });
  const categoryName = categoryNameFromKey(params.categoryKey) || params.categoryKey;

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: (page - 1) * PAGE_SIZE + index + 1,
      url: canonicalUrlForPath(`/products/${encodeURIComponent(product.id)}`),
      name: product.productName,
    })),
  };

  const prevHref =
    page > 2
      ? `/category/${encodeURIComponent(params.categoryKey)}?page=${page - 1}`
      : page === 2
        ? `/category/${encodeURIComponent(params.categoryKey)}`
        : null;
  const nextHref = hasMore ? `/category/${encodeURIComponent(params.categoryKey)}?page=${page + 1}` : null;

  return (
    <main className="hero" style={{ maxWidth: 980 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <p className="eyebrow">Category</p>
      <h1>{categoryName}</h1>
      <p>Browse products from verified stores and order directly on WhatsApp.</p>

      <section aria-label={`${categoryName} products`}>
        <ul style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {products.map((product) => (
            <li key={product.id} style={{ listStyle: 'none', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
              <h2 style={{ fontSize: '1rem', margin: 0 }}>
                <Link href={`/products/${encodeURIComponent(product.id)}`}>{product.productName}</Link>
              </h2>
              <p style={{ margin: '8px 0 0' }}>
                {product.storeId ? (
                  <Link href={`/stores/${encodeURIComponent(product.storeId)}`}>{product.storeName}</Link>
                ) : (
                  product.storeName
                )}
                {product.verified ? (
                  <>
                    {' '}
                    <span className="verifiedBadge">Verified</span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <nav aria-label="Category pagination" style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {prevHref ? <Link href={prevHref}>Previous page</Link> : <span aria-disabled="true">Previous page</span>}
        {nextHref ? <Link href={nextHref}>Next page</Link> : <span aria-disabled="true">Next page</span>}
      </nav>
    </main>
  );
}
