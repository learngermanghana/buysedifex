import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Return Policy';
const description = 'Sedifex return and refund guidance for shoppers and stores.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/return-policy'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/return-policy'),
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

export default function ReturnPolicyPage() {
  return (
    <main className="container infoPage">
      <p className="eyebrow">Policy</p>
      <h1>Return Policy</h1>
      <p>Returns and refunds are handled between buyers and stores. Sedifex helps with reporting and mediation.</p>

      <section>
        <h2>For buyers</h2>
        <ul>
          <li>Confirm store return conditions before payment.</li>
          <li>Keep proof of payment and WhatsApp order messages.</li>
          <li>Report unresolved issues through the contact page.</li>
        </ul>
      </section>

      <section>
        <h2>For stores</h2>
        <ul>
          <li>Share clear return timelines and product conditions.</li>
          <li>Respond to customer concerns quickly and respectfully.</li>
          <li>Resolve disputes with transparent communication.</li>
        </ul>
      </section>

      <p>
        Need support? Visit <Link href="/contact">Contact us</Link>.
      </p>
    </main>
  );
}
