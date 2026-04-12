import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Services on Sedifex';
const description =
  'Explore the available Sedifex services for businesses and shoppers, including product promotion and WhatsApp-led sales support.';

const availableServices = [
  {
    name: 'Product listing and showcase',
    description:
      'Create approved product listings with photos, prices, and descriptions so shoppers can discover your offerings quickly.',
  },
  {
    name: 'Business visibility in Ghana',
    description:
      'Get listed in a Ghana-focused marketplace where local customers can browse by category and store.',
  },
  {
    name: 'WhatsApp customer connection',
    description:
      'Turn product interest into conversations instantly through direct WhatsApp contact from each listing.',
  },
  {
    name: 'Store profile management',
    description:
      'Maintain your public store identity with business details, contact channels, and product collection updates.',
  },
];

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/services'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/services'),
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

export default function ServicesPage() {
  return (
    <main className="container infoPage">
      <p className="eyebrow">Services</p>
      <h1>Available services on Sedifex</h1>
      <p>
        Sedifex supports Ghanaian businesses and shoppers with practical, WhatsApp-first tools that make discovery and
        ordering easier.
      </p>

      <section>
        <h2>What is available now</h2>
        <ul>
          {availableServices.map((service) => (
            <li key={service.name}>
              <strong>{service.name}:</strong> {service.description}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Need onboarding help?</h2>
        <p>
          If you are a business owner and want help getting started, visit <Link href="/sell">Sell on Sedifex</Link> or
          contact support for guidance.
        </p>
      </section>

      <div className="inlineLinks">
        <Link href="/sell">Sell on Sedifex</Link>
        <Link href="/contact">Contact support</Link>
      </div>
    </main>
  );
}
