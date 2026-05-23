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

function normalizeType(value?: string) {
  return (value || '').toLowerCase().trim();
}

function getBusinessCounts(profile: StoreProfile) {
  return profile.products.reduce(
    (acc, product) => {
      const type = normalizeType(product.itemType);
      if (type.includes('service')) acc.services += 1;
      else if (type.includes('course')) acc.courses += 1;
      else acc.products += 1;
      return acc;
    },
    { products: 0, services: 0, courses: 0 },
  );
}

function getBusinessBadges(profile: StoreProfile) {
  const counts = getBusinessCounts(profile);
  const badges = [];
  if (counts.products) badges.push('Products');
  if (counts.services) badges.push('Services');
  if (counts.courses) badges.push('Courses');
  if (!badges.length) badges.push('Public profile');
  return badges;
}

function getFeaturedImages(profile: StoreProfile) {
  const productImages = profile.products.flatMap((product) => product.imageUrls || []).filter(Boolean);
  return Array.from(new Set(productImages)).slice(0, 3);
}

function BusinessCard({ storeId, profile }: { storeId: string; profile: StoreProfile }) {
  const counts = getBusinessCounts(profile);
  const badges = getBusinessBadges(profile);
  const featuredImages = getFeaturedImages(profile);
  const location = [profile.city, profile.country].filter(Boolean).join(', ') || 'Location available on profile';
  const itemTotal = counts.products + counts.services + counts.courses;
  const firstImage = profile.storeBannerUrl || featuredImages[0] || profile.storeLogoUrl;

  return (
    <article className="businessCard">
      <div className="businessCardMedia">
        {firstImage ? <img src={firstImage} alt={`${profile.storeName} preview`} loading="lazy" /> : <div className="businessCardPlaceholder">{profile.storeName.slice(0, 1)}</div>}
        {profile.verified ? <span className="businessCardVerified">Verified</span> : null}
      </div>

      <div className="businessCardBody">
        <div className="businessCardTitleRow">
          {profile.storeLogoUrl ? <img src={profile.storeLogoUrl} alt="" className="businessCardLogo" loading="lazy" /> : null}
          <div>
            <h2>{profile.storeName}</h2>
            <p>{location}</p>
          </div>
        </div>

        <div className="businessCardBadges" aria-label="Business offerings">
          {badges.map((badge) => <span key={badge}>{badge}</span>)}
        </div>

        <dl className="businessCardStats">
          <div><dt>Products</dt><dd>{counts.products}</dd></div>
          <div><dt>Services</dt><dd>{counts.services}</dd></div>
          <div><dt>Courses</dt><dd>{counts.courses}</dd></div>
        </dl>

        {featuredImages.length ? (
          <div className="businessCardThumbs" aria-label="Sample listings">
            {featuredImages.map((imageUrl) => <img key={imageUrl} src={imageUrl} alt="" loading="lazy" />)}
          </div>
        ) : null}

        <div className="businessCardActions">
          <Link className="btn btnPrimary" href={`/stores/${encodeURIComponent(storeId)}`}>View business</Link>
          {itemTotal > 0 ? <Link className="btn btnSecondary" href={`/stores/${encodeURIComponent(storeId)}#items`}>Browse items</Link> : null}
        </div>
      </div>
    </article>
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

  const totals = stores.reduce(
    (acc, { profile }) => {
      const counts = getBusinessCounts(profile);
      acc.products += counts.products;
      acc.services += counts.services;
      acc.courses += counts.courses;
      return acc;
    },
    { products: 0, services: 0, courses: 0 },
  );

  return (
    <main className="container businessesPage">
      <section className="businessesHero">
        <div>
          <p className="eyebrow">Businesses</p>
          <h1>Find trusted businesses on Sedifex</h1>
          <p>Explore verified shops, service providers, schools, consultants, and local brands offering products, services, courses, bookings, and checkout options.</p>
          <div className="heroActions">
            <Link className="btn btnPrimary" href="/products">Shop products</Link>
            <Link className="btn btnSecondary" href="/services">Book services</Link>
            <Link className="btn btnGhost" href="/courses">Explore courses</Link>
          </div>
        </div>
        <div className="businessesHeroStats" aria-label="Marketplace summary">
          <div><strong>{stores.length}</strong><span>verified businesses</span></div>
          <div><strong>{totals.products}</strong><span>products</span></div>
          <div><strong>{totals.services}</strong><span>services</span></div>
          <div><strong>{totals.courses}</strong><span>courses</span></div>
        </div>
      </section>

      <section className="businessesToolbar" aria-label="Business filters">
        <div>
          <h2>Browse by what you need</h2>
          <p>Choose a business, view its profile, then buy, book, register, or contact directly.</p>
        </div>
        <div className="businessesToolbarLinks">
          <Link href="/products">Products</Link>
          <Link href="/services">Services</Link>
          <Link href="/courses">Courses</Link>
          <Link href="/search">Search marketplace</Link>
        </div>
      </section>

      <section className="businessGrid" aria-label="Verified businesses">
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
