import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Shipping and Delivery Policy';
const description = 'Sedifex shipping and delivery policy guidance for shoppers and stores.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/shipping-delivery-policy'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/shipping-delivery-policy'),
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

export default function ShippingDeliveryPolicyPage() {
  return (
    <main className="container infoPage">
      <p className="eyebrow">Policy</p>
      <h1>Shipping and Delivery Policy</h1>
      <p>
        After a customer makes a request, the customer will be contacted to confirm delivery details. A dispatch rider
        then delivers the product to the agreed location.
      </p>

      <section>
        <h2>How fulfillment works</h2>
        <ul>
          <li>Customer places a request for a product.</li>
          <li>The store contacts the customer to confirm delivery address, timing, and fees.</li>
          <li>A dispatch rider delivers the order based on the confirmed details.</li>
          <li>Customers can also visit the store directly to pick up products.</li>
        </ul>
      </section>

      <section>
        <h2>For stores</h2>
        <ul>
          <li>Communicate delivery coverage areas and costs clearly before accepting an order.</li>
          <li>Share realistic dispatch and delivery timelines with customers.</li>
          <li>Notify customers promptly when delays or stock issues affect delivery.</li>
        </ul>
      </section>

      <p>
        Need help? Visit <Link href="/contact">Contact us</Link>.
      </p>
    </main>
  );
}
