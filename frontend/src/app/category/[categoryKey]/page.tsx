import type { Metadata } from 'next';
import Link from 'next/link';
import { getProductsByCategory, listPublicCategoryKeys } from '@/lib/public-stores';
import { getStoreHref } from '@/lib/store-route';
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
  try {
    const categoryKeys = await listPublicCategoryKeys();
    return categoryKeys.map((categoryKey) => ({ categoryKey }));
  } catch (error) {
    console.warn('Unable to list public category keys during static generation.', error);
    return [];
  }
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


  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How do I buy ${categoryName} products on Sedifex?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Open a product and use the WhatsApp contact button to order directly from the seller.',
        },
      },
      {
        '@type': 'Question',
        name: `Are ${categoryName} stores verified?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sedifex marks stores with a Verified badge when applicable on listings and store pages.',
        },
      },
    ],
  };

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: (page - 1) * PAGE_SIZE + index + 1,
      url: canonicalUrlForPath(getStoreHref(product.storeId, product.storeName) ?? '/'),
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
    <main className="categoryPage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <p className="eyebrow">Category</p>
      <h1>{categoryName}</h1>
      <p>Browse products from verified stores and order directly on WhatsApp.</p>

      <section aria-label={`${categoryName} products`}>
        <ul className="categoryProductsGrid">
          {products.map((product) => {
            const storeHref = getStoreHref(product.storeId, product.storeName);

            return (
              <li key={product.id} className="categoryProductCard">
                <h2>{product.productName}</h2>
                <p>
                  {storeHref ? (
                    <Link href={storeHref}>{product.storeName}</Link>
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
            );
          })}
        </ul>
      </section>

      <nav aria-label="Category pagination" className="categoryPagination">
        {prevHref ? <Link href={prevHref}>Previous page</Link> : <span aria-disabled="true">Previous page</span>}
        {nextHref ? <Link href={nextHref}>Next page</Link> : <span aria-disabled="true">Next page</span>}
      </nav>
    </main>
  );
}
