import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStoreProfileById, listPublicStoreIds } from '@/lib/public-stores';
import { extractStoreIdFromRouteParam, getStoreHref } from '@/lib/store-route';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

type StorePageProps = {
  params: { storeId: string };
};

const buildStoreTitle = (storeName: string, city?: string) => {
  const normalizedCity = city?.trim();
  return normalizedCity ? `${storeName} in ${normalizedCity} | Buy on Sedifex` : `${storeName} | Buy on Sedifex`;
};

const buildStoreDescription = (storeName: string, city?: string, country?: string) => {
  const location = [city, country].filter((part) => typeof part === 'string' && part.trim().length > 0).join(', ');
  const locationText = location ? ` in ${location}` : '';
  return `Shop products from ${storeName}${locationText}. Browse available items and order via WhatsApp on Sedifex.`;
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
  const routeStoreId = extractStoreIdFromRouteParam(params.storeId);
  const profile = await getStoreProfileById(routeStoreId || params.storeId);

  if (!profile) {
    return {
      title: 'Store not found | Buy on Sedifex',
      description: 'The requested store could not be found on Sedifex.',
      robots: { index: false, follow: false },
    };
  }

  const canonicalPath = getStoreHref(profile.storeId, profile.storeName, profile.storeSlug) ?? `/stores/${encodeURIComponent(params.storeId)}`;
  const canonicalUrl = canonicalUrlForPath(canonicalPath);
  const title = buildStoreTitle(profile.storeName, profile.city);
  const description = buildStoreDescription(profile.storeName, profile.city, profile.country);
  const socialImage = profile.storeBannerUrl ?? profile.storeLogoUrl;
  const socialImages = [{ url: socialImage ?? defaultSocialImageUrl() }];

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
      siteName: 'Sedifex',
      images: socialImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: socialImages.map((image) => image.url),
    },
  };
}

export default async function StorePage({ params }: StorePageProps) {
  const routeStoreId = extractStoreIdFromRouteParam(params.storeId);
  const profile = await getStoreProfileById(routeStoreId || params.storeId);

  if (!profile) {
    notFound();
  }

  const canonicalUrl = canonicalUrlForPath(getStoreHref(profile.storeId, profile.storeName, profile.storeSlug) ?? `/stores/${encodeURIComponent(params.storeId)}`);
  const hasLocation = Boolean(profile.addressLine1 || profile.city || profile.country);
  const sameAs = Array.isArray(profile.sameAs) ? profile.sameAs : [];
  const products = Array.isArray(profile.products) ? profile.products : [];

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
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };

  const categoryKeys = Array.from(new Set(products.map((product) => product.categoryKey).filter(Boolean))) as string[];
  const normalizedPhone = (profile.storePhone ?? '').replace(/[^\d+]/g, '');
  const normalizedWhatsapp = (profile.storeWhatsapp ?? '').trim();
  const whatsappLink =
    normalizedWhatsapp.startsWith('http://') || normalizedWhatsapp.startsWith('https://')
      ? normalizedWhatsapp
      : normalizedPhone
        ? `https://wa.me/${normalizedPhone.replace(/[^\d]/g, '')}`
        : '';
  const mailtoHref = profile.storeEmail ? `mailto:${profile.storeEmail}` : '';

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How do I contact ${profile.storeName}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Use the call, email, or WhatsApp actions available on this page.',
        },
      },
      {
        '@type': 'Question',
        name: `Does ${profile.storeName} have verified products?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Store and product verification badges are shown on Sedifex when available.',
        },
      },
    ],
  };


  return (
    <main className="storePage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
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
        </p>
        <div className="productStoreActions">
          {profile.storePhone ? (
            <a href={`tel:${normalizedPhone || profile.storePhone}`}>Call {profile.storePhone}</a>
          ) : (
            <span aria-disabled="true">Phone unavailable</span>
          )}
          {mailtoHref ? <a href={mailtoHref}>Email store</a> : <span aria-disabled="true">Email unavailable</span>}
          {whatsappLink ? (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          ) : (
            <span aria-disabled="true">WhatsApp unavailable</span>
          )}
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
          <h2>Categories</h2>
          <ul>
            {categoryKeys.map((category) => (
              <li key={category}>
                <Link href={`/category/${encodeURIComponent(category)}`}>{category}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="storeInfoCard" aria-label="Store products">
        <h2>Products from {profile.storeName}</h2>
        <p>🚚 Delivery: Discuss with seller · 💳 Payment methods: MoMo, cash, and seller-approved options.</p>
        <ul>
          {products.map((product) => (
            <li key={product.id}>
              {product.productName}
              {product.categoryKey ? (
                <>
                  {' '}
                  in{' '}
                  <Link href={`/category/${encodeURIComponent(product.categoryKey)}`}>{product.categoryKey}</Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
