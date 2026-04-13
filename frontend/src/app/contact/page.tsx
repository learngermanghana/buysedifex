import type { Metadata } from 'next';
import Link from 'next/link';
import { ConcernReportForm } from '@/components/concern-report-form';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Contact Sedifex';
const description = 'Get support for marketplace issues, listing questions, and trust concerns on Sedifex.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/contact'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/contact'),
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

export default function ContactPage() {
  const rawPhone = '0205706589';
  const whatsappNumber = '233205706589';

  return (
    <main className="container infoPage">
      <p className="eyebrow">Contact</p>
      <h1>Support and contact</h1>
      <p>If you need help with listings, trust concerns, disputes, or account questions, contact Sedifex directly.</p>

      <section>
        <h2>Contact channels</h2>
        <ul>
          <li>
            Email: <a href="mailto:info@sedifex.com">info@sedifex.com</a>
          </li>
          <li>
            Phone / WhatsApp: <a href={`tel:${rawPhone}`}>{rawPhone}</a>
          </li>
          <li>
            WhatsApp direct: <a href={`https://wa.me/${whatsappNumber}`}>chat on WhatsApp</a>
          </li>
        </ul>
      </section>

      <section>
        <h2>What to include in support requests</h2>
        <ul>
          <li>Store name or product name involved.</li>
          <li>Short summary of the issue and relevant date/time.</li>
          <li>Any screenshots or order conversation context that helps resolve the issue quickly.</li>
        </ul>
      </section>

      <section>
        <p className="eyebrow">Trust and safety</p>
        <h2>Report a concern</h2>
        <p>Use this secure form to report fraud risk, product concerns, or account abuse for review by Sedifex support.</p>
        <ConcernReportForm />
      </section>

      <div className="inlineLinks">
        <Link href="/privacy">Privacy policy</Link>
        <Link href="/terms">Terms of service</Link>
      </div>
    </main>
  );
}
