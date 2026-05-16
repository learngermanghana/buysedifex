import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ShareButton } from '@/components/share-button';
import { StoreProductsSection } from '@/components/store-products-section';
import { getStoreProfileById, listPublicStoreIds } from '@/lib/public-stores';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';
import { extractStoreIdFromRouteParam } from '@/lib/store-route';

type StorePageProps = {
  params: { storeId: string };
};

const buildStoreTitle = (storeName: string, city?: string) => {
  const normalizedCity = city?.trim();
  return normalizedCity ? `${storeName} in ${normalizedCity} | Sedifex Market` : `${storeName} | Sedifex Market`;
};

const buildStoreDescription = (storeName: string, city?: string, country?: string) => {
  const location = [city, country].filter((part) => typeof part === 'string' && part.trim().length > 0).join(', ');
  const locationText = location ? ` in ${location}` : '';
  return `Shop products from verified store ${storeName}${locationText}. Browse available items and order securely on Sedifex Market.`;
};

export async function generateStaticParams() {
  try {
    const storeIds = await listPublicStoreIds();
    return storeIds.map((storeId) => ({ storeId }));
  } catch (error) {
    console.warn('Unable to list public store ids during static generation.', error);
    return [];
  }
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const normalizedStoreId = extractStoreIdFromRouteParam(params.storeId);
  const profile = await getStoreProfileById(normalizedStoreId);

  if (!profile) {
    return {
      title: 'Store not found | Sedifex Market',
      description: 'The requested store could not be found on Sedifex Market.',
      robots: { index: false, follow: false },
    };
  }

  const canonicalUrl = canonicalUrlForPath(`/stores/${params.storeId}`);
  const title = buildStoreTitle(profile.storeName, profile.city);
  const description = buildStoreDescription(profile.storeName, profile.city, profile.country);
  const socialImage = profile.storeBannerUrl ?? profile.storeLogoUrl ?? defaultSocialImageUrl();

  return {
    title,
    description,
    keywords: buildSeoKeywords(
      `${profile.storeName.toLowerCase()} ghana`,
      profile.city ? `${profile.storeName.toLowerCase()} ${profile.city.toLowerCase()}` : 'shops in ghana',
    ),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title,
      description,
      siteName: 'Sedifex Market',
      images: [{ url: socialImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
    },
  };
}

export default async function StorePage({ params }: StorePageProps) {
  const normalizedStoreId = extractStoreIdFromRouteParam(params.storeId);
  const profile = await getStoreProfileById(normalizedStoreId);

  if (!profile) {
    notFound();
  }

  const storePath = `/stores/${params.storeId}`;
  const categoryKeys = Array.from(new Set(profile.products.map((product) => product.categoryKey).filter(Boolean))) as string[];
  const normalizedPhone = (profile.storePhone ?? '').replace(/[^\d+]/g, '');
  const normalizedWhatsapp = (profile.storeWhatsapp ?? '').trim();
  const whatsappLink =
    normalizedWhatsapp.startsWith('http://') || normalizedWhatsapp.startsWith('https://')
      ? normalizedWhatsapp
      : normalizedPhone
        ? `https://wa.me/${normalizedPhone.replace(/[^\d]/g, '')}`
        : '';
  const mailtoHref = profile.storeEmail ? `mailto:${profile.storeEmail}` : '';
  const hasCoordinates = Number.isFinite(profile.latitude) && Number.isFinite(profile.longitude);

  return (
    <main className="storePage">
      <section className="storeHero">
        <p className="eyebrow">Store</p>
        <h1>
          {profile.storeName} {profile.verified ? <span className="verifiedBadge">Verified</span> : null}
        </h1>
        {profile.storeLogoUrl ? (
          <Image
            src={profile.storeLogoUrl}
            alt={`${profile.storeName} logo`}
            width={88}
            height={88}
            style={{ borderRadius: 999, border: '1px solid #e2e8f0' }}
          />
        ) : null}
        <p>
          {[profile.city, profile.country].filter(Boolean).join(', ') || 'Location unavailable'}
          {profile.addressLine1 ? ` · ${profile.addressLine1}` : ''}
          {profile.area ? ` · Area: ${profile.area}` : ''}
        </p>
        <p><strong>Opening hours:</strong> {profile.openingHours ?? 'Contact store for opening hours'}</p>
        {hasCoordinates ? <p><strong>GPS:</strong> {profile.latitude}, {profile.longitude}</p> : null}
        <div className="productStoreActions">
          {profile.storePhone ? <a href={`tel:${normalizedPhone || profile.storePhone}`}>Call {profile.storePhone}</a> : <span aria-disabled="true">Phone unavailable</span>}
          {mailtoHref ? <a href={mailtoHref}>Email store</a> : <span aria-disabled="true">Email unavailable</span>}
          {whatsappLink ? <a href={whatsappLink} target="_blank" rel="noopener noreferrer">WhatsApp</a> : <span aria-disabled="true">WhatsApp unavailable</span>}
          <ShareButton
            className="secondaryButton"
            url={storePath}
            title={`${profile.storeName} on Sedifex`}
            text={`Check out ${profile.storeName} on Sedifex.`}
            label="Share store"
          />
        </div>
      </section>

      {profile.storeBannerUrl ? (
        <Image
          src={profile.storeBannerUrl}
          alt={`${profile.storeName} storefront banner`}
          width={1200}
          height={675}
          priority
          sizes="(max-width: 768px) 100vw, 920px"
          style={{ width: '100%', height: 'auto', borderRadius: 12 }}
        />
      ) : null}

      {categoryKeys.length > 0 ? (
        <section className="storeInfoCard" aria-label="Store categories">
          <h2>Store tags</h2>
          <ul>
            {categoryKeys.slice(0, 6).map((category) => (
              <li key={category}>{category}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <StoreProductsSection storeId={normalizedStoreId} storeName={profile.storeName} />
    </main>
  );
}
