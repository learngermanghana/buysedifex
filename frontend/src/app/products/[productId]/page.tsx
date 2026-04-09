import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicProductById } from '@/lib/public-products';
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
      name: product.storeName,
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
    <main className="hero" style={{ maxWidth: 880 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="eyebrow">Product details</p>
      <h1>{product.productName}</h1>
      {product.description ? <p>{product.description}</p> : null}
      <p>
        <strong>{product.storeName}</strong>
        {product.storeId ? (
          <>
            {' '}
            · <Link href={`/stores/${encodeURIComponent(product.storeId)}`}>Visit store page</Link>
          </>
        ) : null}
      </p>
      <p>{priceLabel}</p>
      {product.categoryKey && (
        <p>
          Category: <Link href={`/category/${encodeURIComponent(product.categoryKey)}`}>{product.categoryKey}</Link>
        </p>
      )}
      {availabilityLabel && <p>Availability: {availabilityLabel}</p>}
      {product.imageUrls.length > 0 && (
        <section
          aria-label="Product images"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}
        >
          {product.imageUrls.map((imageUrl) => (
            <Image
              key={imageUrl}
              src={imageUrl}
              alt={product.productName}
              loading="lazy"
              width={480}
              height={480}
              sizes="(max-width: 768px) 100vw, 33vw"
              style={{ width: '100%', height: 'auto', borderRadius: 12 }}
            />
          ))}
        </section>
      )}
    </main>
  );
}
