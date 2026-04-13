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
          <li>Businesses with clear contact details and active WhatsApp communication.</li>
          <li>Stores with accurate product details, prices, and images.</li>
          <li>Sellers who can respond quickly to customer inquiries and order follow-ups.</li>
        </ul>
      </section>

      <section>
        <h2>Approval flow</h2>
        <ol>
          <li>Email your store profile, listing information, and business registration to info@sedifex.com.</li>
          <li>Our team reviews your documents and verifies your store for trust and quality standards.</li>
          <li>Approved stores are published on www.sedifexmarket.com and become discoverable across marketplace pages.</li>
        </ol>
      </section>

      <section>
        <h2>If your store is not approved yet</h2>
        <p>
          You can still manage your own products internally using Sedifex while your marketplace application remains under
          review.
        </p>
      </section>

      <section>
        <h2>How selling works</h2>
        <ul>
          <li>Customers discover your products on Sedifex.</li>
          <li>They tap through to WhatsApp to chat directly with your store.</li>
          <li>You finalize product availability, payment, and delivery directly with the buyer.</li>
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
