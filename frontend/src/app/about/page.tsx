import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'About Sedifex';
const description =
  'Learn how Sedifex works for shoppers and businesses, including trust, approval, and WhatsApp-first ordering.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/about'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/about'),
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

export default function AboutPage() {
  return (
    <main className="container infoPage">
      <p className="eyebrow">About Sedifex</p>
      <h1>How Sedifex works</h1>
      <p>
        Sedifex is a Ghana-focused marketplace that helps people discover products from local stores and connect directly
        with sellers on WhatsApp to complete purchases.
      </p>

      <section>
        <h2>For shoppers</h2>
        <ul>
          <li>Browse products by category and store from approved businesses.</li>
          <li>See clear product details before contacting a seller.</li>
          <li>Use one tap to message the seller on WhatsApp and confirm availability, payment, and delivery.</li>
        </ul>
      </section>

      <section>
        <h2>For businesses</h2>
        <ul>
          <li>Promote your products to ready-to-buy local customers.</li>
          <li>Showcase your brand and inventory without building a full e-commerce stack.</li>
          <li>Close sales using your existing WhatsApp workflow.</li>
        </ul>
      </section>

      <section>
        <h2>Trust and quality process</h2>
        <ul>
          <li>Store visibility is tied to platform approval checks.</li>
          <li>Public listings are intended to represent active and legitimate businesses.</li>
          <li>
            If you need help with listing concerns or disputes, visit our <Link href="/contact">contact page</Link>.
          </li>
        </ul>
      </section>

      <div className="inlineLinks">
        <Link href="/sell">Sell on Sedifex</Link>
        <Link href="/contact">Contact support</Link>
      </div>
    </main>
  );
}
