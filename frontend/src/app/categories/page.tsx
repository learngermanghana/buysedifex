import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublicCategoryKeys } from '@/lib/public-stores';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Browse product categories in Ghana';
const description = 'Explore Sedifex categories to find products from verified stores in Ghana.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('ghana product categories', 'marketplace categories ghana'),
  alternates: { canonical: canonicalUrlForPath('/categories') },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/categories'),
    title,
    description,
    siteName: 'Sedifex',
    images: [{ url: defaultSocialImageUrl() }],
  },
};

export default async function CategoriesIndexPage() {
  const categoryKeys = await listPublicCategoryKeys().catch(() => []);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How do I order products from a category?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Open any category, choose a product, and contact the store via WhatsApp.',
        },
      },
    ],
  };

  return (
    <main className="container infoPage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <section>
        <p className="eyebrow">Categories</p>
        <h1>Browse all categories</h1>
        <p>Pick a category to view products from verified local stores.</p>
      </section>
      <section>
        <ul>
          {categoryKeys.map((categoryKey) => (
            <li key={categoryKey}>
              <Link href={`/category/${encodeURIComponent(categoryKey)}`}>{categoryKey}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
