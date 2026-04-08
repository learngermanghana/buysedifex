import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buildCategoryPath, formatCategoryName } from '@/lib/category';
import { getStoreProfileById } from '@/lib/public-stores';

type StorePageProps = {
  params: { storeId: string };
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://buy.sedifex.com';

const buildStoreTitle = (storeName: string, city?: string) => {
  const normalizedCity = city?.trim();
  return normalizedCity ? `${storeName} in ${normalizedCity} | Buy on Sedifex` : `${storeName} | Buy on Sedifex`;
};

const buildStoreDescription = (storeName: string, city?: string, country?: string) => {
  const location = [city, country].filter((part) => typeof part === 'string' && part.trim().length > 0).join(', ');
  const locationText = location ? ` in ${location}` : '';
  return `Shop products from ${storeName}${locationText}. Browse available items and order via WhatsApp on Sedifex.`;
};

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const profile = await getStoreProfileById(params.storeId);

  if (!profile) {
    return {
      title: 'Store not found | Buy on Sedifex',
      description: 'The requested store could not be found on Sedifex.',
      robots: { index: false, follow: false },
    };
  }

  const canonicalPath = `/stores/${params.storeId}`;
  const canonicalUrl = new URL(canonicalPath, siteUrl).toString();
  const title = buildStoreTitle(profile.storeName, profile.city);
  const description = buildStoreDescription(profile.storeName, profile.city, profile.country);
  const socialImage = profile.storeBannerUrl ?? profile.storeLogoUrl;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      url: canonicalUrl,
      title,
      description,
      siteName: 'Sedifex',
      ...(socialImage ? { images: [{ url: socialImage }] } : {}),
    },
    twitter: {
      card: socialImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(socialImage ? { images: [socialImage] } : {}),
    },
  };
}

export default async function StorePage({ params }: StorePageProps) {
  const profile = await getStoreProfileById(params.storeId);

  if (!profile) {
    notFound();
  }

  const canonicalUrl = new URL(`/stores/${params.storeId}`, siteUrl).toString();
  const hasLocation = Boolean(profile.addressLine1 || profile.city || profile.country);

  const organizationType = hasLocation ? 'LocalBusiness' : 'OnlineStore';
  const address = hasLocation
    ? {
        '@type': 'PostalAddress',
        ...(profile.addressLine1 ? { streetAddress: profile.addressLine1 } : {}),
        ...(profile.city ? { addressLocality: profile.city } : {}),
        ...(profile.country ? { addressCountry: profile.country } : {}),
      }
    : undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': organizationType,
    name: profile.storeName,
    url: canonicalUrl,
    ...(profile.storeLogoUrl ? { logo: profile.storeLogoUrl } : {}),
    ...(profile.storeBannerUrl ? { image: profile.storeBannerUrl } : {}),
    ...(profile.storePhone ? { telephone: profile.storePhone } : {}),
    ...(address ? { address } : {}),
    ...(profile.sameAs.length > 0 ? { sameAs: profile.sameAs } : {}),
  };

  const categoryKeys = Array.from(new Set(profile.products.map((product) => product.categoryKey).filter(Boolean))) as string[];

  return (
    <main className="hero" style={{ maxWidth: 920 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="eyebrow">Store</p>
      <h1>{profile.storeName}</h1>
      {profile.city || profile.country ? <p>{[profile.city, profile.country].filter(Boolean).join(', ')}</p> : null}
      {profile.addressLine1 ? <p>{profile.addressLine1}</p> : null}
      {profile.storePhone ? <p>Phone: {profile.storePhone}</p> : null}
      {profile.storeBannerUrl ? <img src={profile.storeBannerUrl} alt={`${profile.storeName} storefront banner`} style={{ width: '100%', borderRadius: 12 }} /> : null}

      {categoryKeys.length > 0 ? (
        <section aria-label="Store categories">
          <h2>Categories</h2>
          <ul>
            {categoryKeys.map((category) => (
              <li key={category}>
                <Link href={buildCategoryPath(category)}>{formatCategoryName(category)}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Store products">
        <h2>Products from {profile.storeName}</h2>
        <ul>
          {profile.products.map((product) => (
            <li key={product.id}>
              <Link href={`/products/${encodeURIComponent(product.id)}`}>{product.productName}</Link>
              {product.categoryKey ? (
                <>
                  {' '}
                  in{' '}
                  <Link href={buildCategoryPath(product.categoryKey)}>{formatCategoryName(product.categoryKey)}</Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
