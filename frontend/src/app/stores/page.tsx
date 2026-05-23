import type { Metadata } from 'next';
import Link from 'next/link';
import { getStoreProfileById, listPublicStoreIds } from '@/lib/public-stores';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Browse trusted businesses on Sedifex';
const description = 'Discover verified businesses offering products, services, courses, bookings, and checkout options on Sedifex.';

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('ghana businesses directory', 'verified local businesses ghana', 'services courses products ghana'),
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
        <p className="eyebrow">Businesses</p>
        <h1>Find trusted businesses on Sedifex</h1>
        <p>Explore verified businesses offering products, services, courses, bookings, and checkout options.</p>
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
