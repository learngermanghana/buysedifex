import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Sell on Sedifex';
const description =
  'For businesses in Ghana: learn requirements, approval flow, and benefits of listing products on Sedifex.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/sell'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/sell'),
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

export default function SellPage() {
  return (
    <main className="container infoPage">
      <p className="eyebrow">For Businesses</p>
      <h1>Sell on Sedifex</h1>
      <p>
        Sedifex helps stores promote products to more customers while keeping WhatsApp as the main sales conversation
        channel.
      </p>

      <section>
        <h2>Who can apply</h2>
        <ul>
          <li>
            To appear on Sedifex Market, a store must create an account at{' '}
            <Link href="https://wwe.sedifex.com">wwe.sedifex.com</Link> and add products and services.
          </li>
          <li>Stores must provide accurate product details, prices, images, and contact information.</li>
          <li>Sellers should be ready to respond quickly to customer inquiries and order follow-ups.</li>
        </ul>
      </section>

      <section>
        <h2>Approval flow</h2>
        <ol>
          <li>Set up your store account and keep your profile and product details complete.</li>
          <li>Our team reviews your store and verifies it for trust, quality, and fraud prevention standards.</li>
          <li>
            Only verified stores are shown on Sedifex Market, and products added in Sedifex are automatically shown here
            after verification.
          </li>
        </ol>
      </section>

      <section>
        <h2>If your store is not verified yet</h2>
        <p>
          You can continue to use Sedifex for your store activities, but your store and products will not appear on
          Sedifex Market until verification is complete.
        </p>
      </section>

      <section>
        <h2>How Sedifex Market works</h2>
        <ul>
          <li>Sedifex acts as a marketplace mediator to recommend stores to customers.</li>
          <li>We do not accept payments on behalf of any shop.</li>
          <li>Each verified shop must have a location.</li>
          <li>
            If a store does not provide a location, customers should pay only after receiving their products through
            delivery.
          </li>
          <li>If you notice suspicious behavior, please report it immediately as a potential fraud alert.</li>
        </ul>
      </section>

      <section>
        <h2>Benefits</h2>
        <ul>
          <li>Extra visibility for your products and brand.</li>
          <li>Lower friction for conversion using direct messaging.</li>
          <li>Faster time to market compared to building a full online store from scratch.</li>
        </ul>
      </section>

      <div className="inlineLinks">
        <Link href="/contact">Contact Sedifex</Link>
        <Link href="mailto:info@sedifex.com">info@sedifex.com</Link>
      </div>
    </main>
  );
}
