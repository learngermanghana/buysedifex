import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicProductById } from '@/lib/public-products';
import { getStoreProfileById } from '@/lib/public-stores';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

type ProductPageProps = {
  params: { productId: string };
};

const buildLocation = (city?: string, country?: string) => {
  const parts = [city, country].filter(Boolean);
  if (parts.length === 0) {
    return '';
  }

  return ` in ${parts.join(', ')}`;
};

const normalizeDisplayCurrency = (currency?: string) => {
  const normalizedCurrency = (currency ?? 'GHS').toUpperCase();
  return normalizedCurrency === 'USD' ? 'GHS' : normalizedCurrency;
};

const sanitizePhoneForTel = (value?: string) => {
  if (!value) {
    return '';
  }

  return value.replace(/[^\d+]/g, '');
};

const buildMetadataDescription = (input: {
  productName: string;
  storeName: string;
  city?: string;
  country?: string;
  currency?: string;
  price?: number;
}) => {
  const location = buildLocation(input.city, input.country);
  const displayCurrency = normalizeDisplayCurrency(input.currency);
  const currencyLabel = displayCurrency === 'GHS' ? 'Cedis (GH₵)' : displayCurrency;
  const priceText = input.price == null ? 'Price unavailable' : `${currencyLabel} ${input.price}`;

  return `Buy ${input.productName} from ${input.storeName}${location}. Price: ${priceText}. Order via WhatsApp on Sedifex.`;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { productId } = params;
  const product = await getPublicProductById(productId);

  if (!product) {
    return {
      title: 'Product not found | Sedifex',
      description: 'The requested product could not be found on Sedifex.',
      robots: { index: false, follow: false },
    };
  }

  const canonicalPath = `/products/${encodeURIComponent(productId)}`;
  const canonicalUrl = canonicalUrlForPath(canonicalPath);
  const title = `${product.productName}${buildLocation(product.city)} | ${product.storeName} | Sedifex`;
  const description = buildMetadataDescription(product);
  const socialImages =
    product.imageUrls.length > 0 ? product.imageUrls.map((url) => ({ url })) : [{ url: defaultSocialImageUrl() }];

  return {
    title,
    description,
    keywords: buildSeoKeywords(
      `${product.productName.toLowerCase()} ghana`,
      `${product.storeName.toLowerCase()} products`,
      product.categoryKey ? `${product.categoryKey.toLowerCase()} ghana` : 'buy products online ghana',
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

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { productId } = params;
  const product = await getPublicProductById(productId);

  if (!product) {
    notFound();
  }

  const storeProfile = product.storeId ? await getStoreProfileById(product.storeId) : null;
  const resolvedStoreName = storeProfile?.storeName ?? product.storeName;
  const resolvedLocation =
    [storeProfile?.city ?? product.city, storeProfile?.country ?? product.country].filter(Boolean).join(', ') ||
    'Location unavailable';
  const resolvedStorePhone = storeProfile?.storePhone?.trim() || product.waLink?.trim() || 'Phone unavailable';
  const storePhoneHref = sanitizePhoneForTel(storeProfile?.storePhone ?? product.waLink);
  const resolvedStoreId = storeProfile?.storeId ?? product.storeId;
  const hasStorePage = Boolean(resolvedStoreId);
  const hasWebsite = Boolean(storeProfile?.websiteUrl);
  const isVerifiedStore = storeProfile?.verified ?? product.verified ?? false;

  const productUrl = canonicalUrlForPath(`/products/${encodeURIComponent(productId)}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.productName,
    description: product.description,
    ...(product.imageUrls.length > 0 ? { image: product.imageUrls } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    brand: {
      '@type': 'Brand',
      name: resolvedStoreName,
    },
    ...(product.categoryKey ? { category: product.categoryKey } : {}),
    offers: {
      '@type': 'Offer',
      ...(product.price != null ? { price: product.price } : {}),
      ...(product.currency ? { priceCurrency: normalizeDisplayCurrency(product.currency) } : { priceCurrency: 'GHS' }),
      ...(typeof product.stockCount === 'number'
        ? {
            availability:
              product.stockCount > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
          }
        : {}),
      url: productUrl,
    },
  };

  const displayCurrency = normalizeDisplayCurrency(product.currency);
  const currencyLabel = displayCurrency === 'GHS' ? 'Cedis (GH₵)' : displayCurrency;
  const priceLabel = product.price == null ? 'Price unavailable' : `${currencyLabel} ${product.price.toFixed(2)}`;
  const availabilityLabel =
    typeof product.stockCount === 'number' ? (product.stockCount > 0 ? 'In stock' : 'Out of stock') : undefined;

  return (
    <main className="productDetailPage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="productSummaryCard">
        <div>
          <p className="eyebrow">Product details</p>
          <h1>{product.productName}</h1>
          {product.description ? <p>{product.description}</p> : <p>No description available for this product yet.</p>}
        </div>

        <div className="productStats">
          <p>
            <strong>Price:</strong> {priceLabel}
          </p>
          {availabilityLabel ? (
            <p>
              <strong>Availability:</strong> {availabilityLabel}
            </p>
          ) : null}
          {product.categoryKey ? (
            <p>
              <strong>Category:</strong>{' '}
              <Link href={`/category/${encodeURIComponent(product.categoryKey)}`}>{product.categoryKey}</Link>
            </p>
          ) : null}
        </div>
      </section>

      <section className="productStoreCard" aria-label="Store contact details">
        <h2>Store information</h2>
        <p>
          <strong>Name:</strong> {resolvedStoreName}{' '}
          {isVerifiedStore ? <span className="verifiedBadge">Verified</span> : null}
        </p>
        <p>
          <strong>Location:</strong> {resolvedLocation}
        </p>
        <p>
          <strong>Phone:</strong>{' '}
          {storePhoneHref ? <a href={`tel:${storePhoneHref}`}>{resolvedStorePhone}</a> : <span>{resolvedStorePhone}</span>}
        </p>

        <div className="productStoreActions">
          {hasStorePage ? (
            <Link href={`/stores/${encodeURIComponent(resolvedStoreId ?? '')}`}>View store details</Link>
          ) : null}
          {hasWebsite ? (
            <a href={storeProfile?.websiteUrl} target="_blank" rel="noopener noreferrer">
              Visit store website
            </a>
          ) : null}
        </div>
      </section>

      {product.imageUrls.length > 0 ? (
        <section className="productImageGrid" aria-label="Product images">
          {product.imageUrls.map((imageUrl) => (
            <Image
              key={imageUrl}
              src={imageUrl}
              alt={product.productName}
              loading="lazy"
              width={480}
              height={480}
              sizes="(max-width: 768px) 100vw, 33vw"
              style={{ width: '100%', height: 'auto', borderRadius: 14 }}
            />
          ))}
        </section>
      ) : null}
    </main>
  );
}
