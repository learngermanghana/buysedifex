import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Search products and stores in Ghana';
const description = 'Filter by category, city, and price to quickly find trusted products and stores on Sedifex Market.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('search products ghana', 'store finder ghana', 'buy local ghana'),
  alternates: { canonical: canonicalUrlForPath('/search') },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/search'),
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

type SearchPageProps = {
  searchParams?: {
    q?: string;
    category?: string;
    city?: string;
    sort?: 'store-diverse' | 'newest' | 'price' | 'featured';
    minPrice?: string;
    maxPrice?: string;
  };
};

export default function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <main className="container">
      <section className="searchPageIntro">
        <p className="eyebrow">Search + Filter</p>
        <h1>Find products fast</h1>
        <p>Use category, city, and price sorting to discover trusted stores with visible prices and WhatsApp contact.</p>
      </section>
      <ProductGrid
        initialSearchText={searchParams?.q ?? ''}
        initialCategory={searchParams?.category ?? 'all'}
        initialCity={searchParams?.city ?? 'all'}
        initialSort={searchParams?.sort ?? 'store-diverse'}
        initialMinPrice={searchParams?.minPrice ?? ''}
        initialMaxPrice={searchParams?.maxPrice ?? ''}
      />
    </main>
  );
}
