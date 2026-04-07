import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublicProductById } from '@/lib/public-products';

type ProductPageProps = {
  params: { productId: string };
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://buy.sedifex.com';

const buildLocation = (city?: string, country?: string) => {
  const parts = [city, country].filter(Boolean);
  if (parts.length === 0) {
    return '';
  }

  return ` in ${parts.join(', ')}`;
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
  const priceText = input.price == null ? 'Price unavailable' : `${(input.currency ?? 'USD').toUpperCase()} ${input.price}`;

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

  const canonicalPath = `/products/${productId}`;
  const canonicalUrl = new URL(canonicalPath, siteUrl).toString();
  const title = `${product.productName}${buildLocation(product.city)} | ${product.storeName} | Sedifex`;
  const description = buildMetadataDescription(product);
  const ogImages = product.imageUrls.length > 0 ? product.imageUrls.map((url) => ({ url })) : undefined;

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
      images: ogImages,
    },
    twitter: {
      card: ogImages ? 'summary_large_image' : 'summary',
      title,
      description,
      images: product.imageUrls,
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { productId } = params;
  const product = await getPublicProductById(productId);

  if (!product) {
    notFound();
  }

  const productUrl = new URL(`/products/${productId}`, siteUrl).toString();
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
      ...(product.currency ? { priceCurrency: product.currency.toUpperCase() } : {}),
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

  const priceLabel =
    product.price == null ? 'Price unavailable' : `${(product.currency ?? 'USD').toUpperCase()} ${product.price.toFixed(2)}`;
  const availabilityLabel =
    typeof product.stockCount === 'number' ? (product.stockCount > 0 ? 'In stock' : 'Out of stock') : undefined;

  return (
    <main className="hero" style={{ maxWidth: 880 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <p className="eyebrow">Product details</p>
      <h1>{product.productName}</h1>
      <p>{product.description}</p>
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
          Category: <Link href={`/categories/${encodeURIComponent(product.categoryKey)}`}>{product.categoryKey}</Link>
        </p>
      )}
      {availabilityLabel && <p>Availability: {availabilityLabel}</p>}
      {product.imageUrls.length > 0 && (
        <section aria-label="Product images" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {product.imageUrls.map((imageUrl) => (
            <img key={imageUrl} src={imageUrl} alt={product.productName} loading="lazy" style={{ width: '100%', borderRadius: 12 }} />
          ))}
        </section>
      )}
    </main>
  );
}
