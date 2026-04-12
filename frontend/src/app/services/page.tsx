import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';
import { SectionTabs } from '@/components/section-tabs';
import { getStoreProfileById, listPublicStoreIds } from '@/lib/public-stores';

const title = 'Services on Sedifex';
const description =
  'Explore the available Sedifex services for businesses and shoppers, including product promotion and WhatsApp-led sales support.';

const platformServices = [
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

type StoreServiceGroup = {
  storeId: string;
  storeName: string;
  services: string[];
};

const buildStoreServiceGroups = async (): Promise<StoreServiceGroup[]> => {
  try {
    const storeIds = await listPublicStoreIds(100);
    const profiles = await Promise.all(storeIds.map((storeId) => getStoreProfileById(storeId)));

    return profiles
      .flatMap((profile) => {
        if (!profile) return [];

        const services = Array.from(
          new Set(
            profile.products
              .flatMap((product) => (product.categoryKey ? [product.categoryKey] : []))
              .map((service) => service.trim())
              .filter((service) => service.length > 0),
          ),
        ).sort((left, right) => left.localeCompare(right));

        return [
          {
            storeId: profile.storeId,
            storeName: profile.storeName,
            services,
          },
        ];
      })
      .sort((left, right) => left.storeName.localeCompare(right.storeName));
  } catch (error) {
    console.warn('Unable to build store service groups.', error);
    return [];
  }
};

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

export default async function ServicesPage() {
  const storeServiceGroups = await buildStoreServiceGroups();

  return (
    <main className="container infoPage">
      <SectionTabs activeTab="services" />
      <p className="eyebrow">Services</p>
      <h1>Available services on Sedifex</h1>
      <p>
        Sedifex supports Ghanaian businesses and shoppers with practical, WhatsApp-first tools that make discovery and
        ordering easier.
      </p>

      <section>
        <h2>What is available now</h2>
        <ul>
          {platformServices.map((service) => (
            <li key={service.name}>
              <strong>{service.name}:</strong> {service.description}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Available stores and their services</h2>
        {storeServiceGroups.length > 0 ? (
          <div className="storeServicesDropdown">
            {storeServiceGroups.map((group) => (
              <details key={group.storeId}>
                <summary>{group.storeName}</summary>
                {group.services.length > 0 ? (
                  <ul>
                    {group.services.map((service) => (
                      <li key={`${group.storeId}-${service}`}>{service}</li>
                    ))}
                  </ul>
                ) : (
                  <p>This store currently has no published service categories.</p>
                )}
              </details>
            ))}
          </div>
        ) : (
          <p>Store service categories will appear here as verified stores publish products.</p>
        )}
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
