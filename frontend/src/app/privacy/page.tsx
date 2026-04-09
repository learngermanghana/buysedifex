import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Privacy Policy';
const description = 'Sedifex privacy policy for marketplace browsing, contact, analytics, and support.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/privacy'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/privacy'),
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

export default function PrivacyPage() {
  return (
    <main className="container infoPage">
      <p className="eyebrow">Legal</p>
      <h1>Privacy Policy</h1>
      <p>Last updated: April 9, 2026.</p>
      <p>
        Sedifex respects your privacy. This policy explains what information may be collected when you browse products,
        contact sellers, or reach out to platform support.
      </p>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>Basic browsing and analytics data used to improve the platform experience.</li>
          <li>Support contact information you provide when emailing or messaging Sedifex.</li>
          <li>Store and listing data submitted by businesses for marketplace publication.</li>
        </ul>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>Operate, maintain, and improve marketplace pages and search/discovery flows.</li>
          <li>Review and moderate store listings for trust and quality.</li>
          <li>Respond to support questions and resolve disputes when possible.</li>
        </ul>
      </section>

      <section>
        <h2>Data sharing</h2>
        <p>
          Sedifex does not sell your personal data. Information may be shared with service providers only as needed to
          run the marketplace and support operations.
        </p>
      </section>

      <section>
        <h2>Contact for privacy questions</h2>
        <p>
          Email <a href="mailto:info@sedifex.com">info@sedifex.com</a> or visit the <Link href="/contact">contact page</Link>.
        </p>
      </section>
    </main>
  );
}
