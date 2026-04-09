import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Terms of Service';
const description = 'Sedifex marketplace terms for shoppers and businesses using listings and WhatsApp contact flows.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/terms'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/terms'),
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

export default function TermsPage() {
  return (
    <main className="container infoPage">
      <p className="eyebrow">Legal</p>
      <h1>Terms of Service</h1>
      <p>Last updated: April 9, 2026.</p>
      <p>
        By using Sedifex, you agree to these terms. Sedifex provides a discovery marketplace that helps buyers and
        businesses connect, often through direct WhatsApp conversations.
      </p>

      <section>
        <h2>Marketplace role</h2>
        <ul>
          <li>Sedifex enables product discovery and store visibility.</li>
          <li>Final transaction terms, payment, and delivery are agreed between buyer and seller.</li>
          <li>Sellers are responsible for listing accuracy and customer communication.</li>
        </ul>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Do not post misleading, fraudulent, or prohibited product listings.</li>
          <li>Do not abuse or disrupt platform features or other users.</li>
          <li>Comply with applicable laws and regulations in your market.</li>
        </ul>
      </section>

      <section>
        <h2>Account and listing moderation</h2>
        <p>
          Sedifex may review, edit, suspend, or remove stores/listings that violate policy, create trust risk, or fail
          quality checks.
        </p>
      </section>

      <section>
        <h2>Need help?</h2>
        <p>
          Contact <a href="mailto:info@sedifex.com">info@sedifex.com</a> or visit <Link href="/contact">/contact</Link>.
        </p>
      </section>
    </main>
  );
}
