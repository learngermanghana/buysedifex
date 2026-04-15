import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'How stores can add a product';
const description = 'Step-by-step guide for stores to submit product or service listings on Sedifex.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/add-product'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/add-product'),
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

export default function AddProductPage() {
  return (
    <main className="container infoPage">
      <p className="eyebrow">For stores</p>
      <h1>How to add a product or service</h1>
      <p>Stores can publish products and services so customers can discover and contact them quickly.</p>

      <section>
        <h2>Before you submit</h2>
        <ul>
          <li>Prepare clear images and an accurate title.</li>
          <li>Add the correct item type: Product or Service.</li>
          <li>Include price, city, and a valid WhatsApp contact number.</li>
        </ul>
      </section>

      <section>
        <h2>Submission steps</h2>
        <ol>
          <li>Send your store details and listing data to info@sedifex.com.</li>
          <li>Our team verifies listing quality and trust information.</li>
          <li>Approved listings are published on the products or services pages.</li>
        </ol>
      </section>

      <section>
        <h2>Need help?</h2>
        <p>
          Contact <Link href="/contact">Sedifex support</Link> for onboarding help or questions about approvals.
        </p>
      </section>
    </main>
  );
}
