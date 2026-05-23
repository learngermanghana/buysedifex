import type { Metadata } from 'next';
import Link from 'next/link';
import { getStoreProfileById, listPublicStoreIds, type StoreProfile } from '@/lib/public-stores';
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

function getFeaturedImage(profile: StoreProfile) {
  return profile.storeBannerUrl || profile.products.flatMap((product) => product.imageUrls || []).filter(Boolean)[0] || profile.storeLogoUrl;
}

function BusinessCard({ storeId, profile }: { storeId: string; profile: StoreProfile }) {
  const location = [profile.city, profile.country].filter(Boolean).join(', ');
  const imageUrl = getFeaturedImage(profile);

  return (
    <Link className="businessCard businessCardLink" href={`/stores/${encodeURIComponent(storeId)}`}>
      <div className="businessCardMedia">
        {imageUrl ? <img src={imageUrl} alt={`${profile.storeName} preview`} loading="lazy" /> : <div className="businessCardPlaceholder">{profile.storeName.slice(0, 1)}</div>}
        {profile.verified ? <span className="businessCardVerified">Verified</span> : null}
      </div>

      <div className="businessCardBody businessCardBodySimple">
        <div className="businessCardTitleRow">
          {profile.storeLogoUrl ? <img src={profile.storeLogoUrl} alt="" className="businessCardLogo" loading="lazy" /> : null}
          <div>
            <h2>{profile.storeName}</h2>
            {location ? <p>{location}</p> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default async function StoresIndexPage() {
  const storeIds = await listPublicStoreIds().catch(() => []);
  const stores = (
    await Promise.all(
      storeIds.slice(0, 60).map(async (storeId) => ({
        storeId,
        profile: await getStoreProfileById(storeId),
      })),
    )
  ).filter((item): item is { storeId: string; profile: StoreProfile } => Boolean(item.profile));

  return (
    <main className="container businessesPage">
      <section className="businessesHero businessesHeroSimple">
        <div>
          <p className="eyebrow">Businesses</p>
          <h1>Find trusted businesses on Sedifex</h1>
          <p>Explore verified shops, service providers, schools, consultants, and local brands on Sedifex.</p>
          <div className="heroActions">
            <Link className="btn btnPrimary" href="/products">Shop products</Link>
            <Link className="btn btnSecondary" href="/services">Book services</Link>
            <Link className="btn btnGhost" href="/courses">Explore courses</Link>
          </div>
        </div>
      </section>

      <section className="businessesToolbar" aria-label="Business filters">
        <div>
          <h2>Browse verified businesses</h2>
          <p>Open a business page to see its products, services, courses, contact details, and checkout options.</p>
        </div>
        <div className="businessesToolbarLinks">
          <Link href="/products">Products</Link>
          <Link href="/services">Services</Link>
          <Link href="/courses">Courses</Link>
          <Link href="/search">Search marketplace</Link>
        </div>
      </section>

      <section className="businessGrid businessGridSimple" aria-label="Verified businesses">
        {stores.map(({ storeId, profile }) => <BusinessCard key={storeId} storeId={storeId} profile={profile} />)}
      </section>

      {!stores.length ? (
        <section className="businessEmptyState">
          <h2>No verified businesses found yet</h2>
          <p>Verified businesses will appear here when they publish products, services, courses, or a public profile.</p>
          <Link className="btn btnPrimary" href="/sell">Sell on Sedifex</Link>
        </section>
      ) : null}
    </main>
  );
}
