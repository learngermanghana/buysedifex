import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Courses on Sedifex Market';
const description = 'Discover courses from verified Sedifex stores and educators.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('courses ghana', 'register courses sedifex'),
  alternates: { canonical: canonicalUrlForPath('/courses') },
  openGraph: { type: 'website', url: canonicalUrlForPath('/courses'), title, description, siteName: 'Sedifex', images: [{ url: defaultSocialImageUrl() }] },
  twitter: { card: 'summary_large_image', title, description, images: [defaultSocialImageUrl()] },
};

export default function CoursesPage() {
  return <main className="container"><ProductGrid itemTypeFilter="course" /></main>;
}
