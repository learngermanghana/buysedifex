import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';
import { getStoreProfileById, listPublicStoreIds } from '@/lib/public-stores';

const title = 'Services on Sedifex';
const description = 'Browse service categories currently published by verified Sedifex stores.';

type StoreServiceGroup = {
  storeId: string;
  storeName: string;
  services: string[];
};

const buildStoreServiceGroups = async (): Promise<StoreServiceGroup[]> => {
  try {
    const storeIds = await listPublicStoreIds();
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
      <p className="eyebrow">Services</p>
      <h1>Available services on Sedifex</h1>
      <p>
        This page shows service categories submitted by active stores and synced from marketplace data.
      </p>

      <section>
        <h2>Service availability by store</h2>
        <p>These are the service categories currently published by active stores.</p>
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
          <p>No store service categories are published yet. They will appear here once stores add them.</p>
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
