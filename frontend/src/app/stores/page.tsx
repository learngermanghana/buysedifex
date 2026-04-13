import type { Metadata } from 'next';
import Link from 'next/link';
import { getStoreProfileById, listPublicStoreIds } from '@/lib/public-stores';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Browse local stores on Sedifex';
const description = 'Discover verified stores, view their products, and contact them directly on Sedifex.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('ghana stores directory', 'verified local stores ghana'),
  alternates: { canonical: canonicalUrlForPath('/stores') },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/stores'),
    title,
    description,
    siteName: 'Sedifex',
    images: [{ url: defaultSocialImageUrl() }],
  },
};

export default async function StoresIndexPage() {
  const storeIds = await listPublicStoreIds().catch(() => []);
  const stores = (
    await Promise.all(
      storeIds.slice(0, 60).map(async (storeId) => ({
        storeId,
        profile: await getStoreProfileById(storeId),
      })),
    )
  ).filter((item) => item.profile);

  return (
    <main className="container infoPage">
      <section>
        <p className="eyebrow">Stores</p>
        <h1>Find trusted local stores</h1>
        <p>Explore store pages with product listings, location, and contact details.</p>
      </section>

      <section>
        <ul>
          {stores.map(({ storeId, profile }) => (
            <li key={storeId}>
              <Link href={`/stores/${encodeURIComponent(storeId)}`}>{profile?.storeName ?? storeId}</Link>
              {profile?.city ? ` · ${profile.city}` : ''}
              {profile?.verified ? ' · Verified' : ''}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
