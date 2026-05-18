import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormattedDescription } from '@/components/formatted-description';
import { ShareButton } from '@/components/share-button';
import { ProductPurchasePanel } from '@/components/product-purchase-panel';
import { ProductEngagementPanel } from '@/components/product-engagement-panel';
import { getPublicProductById } from '@/lib/public-products';
import { getStoreProfileById } from '@/lib/public-stores';
import { getStoreHref, getStoreRouteId } from '@/lib/store-route';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';
import { extractProductIdFromRouteParam, getProductHref } from '@/lib/product-route';
import { listIntegrationProducts } from '@/lib/sedifex-integration-api';
import { RelatedMarketplaceItems } from '@/components/related-marketplace-items';

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

  return `Buy ${input.productName} from verified store ${input.storeName}${location}. Price: ${priceText}. Secure checkout on Sedifex Market.`;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const normalizedProductId = extractProductIdFromRouteParam(params.productId);
  const product = await getPublicProductById(normalizedProductId);

  if (!product) {
    return {
      title: 'Product not found | Sedifex Market',
      description: 'The requested product could not be found on Sedifex Market.',
      robots: { index: false, follow: false },
    };
  }

  const canonicalPath = getProductHref(product.id, product.productName);
  const canonicalUrl = canonicalUrlForPath(canonicalPath);
  const title = `${product.productName}${buildLocation(product.city)} | ${product.storeName} | Sedifex Market`;
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
      siteName: 'Sedifex Market',
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
  const normalizedProductId = extractProductIdFromRouteParam(params.productId);
  const product = await getPublicProductById(normalizedProductId);

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
  const originalPrice = typeof (product as { originalPrice?: number }).originalPrice === 'number' ? (product as { originalPrice?: number }).originalPrice : null;
  const hasSedifexDeal = originalPrice != null && product.price != null && product.price < originalPrice;
  const resolvedStoreId = getStoreRouteId(storeProfile?.storeId ?? product.storeId, resolvedStoreName);
  const storeHref = getStoreHref(resolvedStoreId ?? undefined, resolvedStoreName);
  const hasStorePage = Boolean(storeHref);
  const hasWebsite = Boolean(storeProfile?.websiteUrl);
  const isVerifiedStore = storeProfile?.verified ?? product.verified ?? false;
  const checkoutProductId = product.sourceProductId?.trim() || product.id;

  const catalogResponse = await listIntegrationProducts({ page: 1, pageSize: 120, sort: 'store-diverse' }).catch(() => ({ items: [] }));
  const relatedPool = catalogResponse.items.map((item) => ({
    id: item.id,
    storeId: item.storeId,
    storeName: item.storeName,
    productName: item.productName,
    categoryKey: item.categoryKey,
    itemType: (item as { itemType?: string }).itemType,
    price: item.price,
    currency: item.currency,
    imageUrls: item.imageUrls,
    listingType: (item as { listingType?: string }).listingType,
    serviceKind: (item as { serviceKind?: string }).serviceKind,
    salesMode: (item as { salesMode?: string }).salesMode,
    marketplaceEnabled: (item as { marketplaceEnabled?: boolean }).marketplaceEnabled,
    public: (item as { public?: boolean }).public,
  }));

  const productPath = getProductHref(product.id, product.productName);
  const productUrl = canonicalUrlForPath(productPath);
  const storeUrl = storeHref ? canonicalUrlForPath(storeHref) : undefined;
  const availability =
    typeof product.stockCount === 'number' && product.stockCount <= 0
      ? 'https://schema.org/OutOfStock'
      : 'https://schema.org/InStock';
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${productUrl}#product`,
      name: product.productName,
      description: product.description,
      ...(product.imageUrls.length > 0 ? { image: product.imageUrls } : {}),
      ...(product.sku ? { sku: product.sku } : {}),
      brand: {
        '@type': 'Brand',
        name: resolvedStoreName,
      },
      seller: {
        '@type': 'Organization',
        name: resolvedStoreName,
        ...(storeUrl ? { url: storeUrl } : {}),
      },
      ...(product.categoryKey ? { category: product.categoryKey } : {}),
      offers: {
        '@type': 'Offer',
        url: productUrl,
        priceCurrency: normalizeDisplayCurrency(product.currency),
        ...(product.price != null ? { price: product.price.toFixed(2) } : {}),
        availability,
        itemCondition: 'https://schema.org/NewCondition',
        seller: {
          '@type': 'Organization',
          name: resolvedStoreName,
        },
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrlForPath('/') },
        ...(storeUrl ? [{ '@type': 'ListItem', position: 2, name: resolvedStoreName, item: storeUrl }] : []),
        { '@type': 'ListItem', position: storeUrl ? 3 : 2, name: product.productName, item: productUrl },
      ],
    },
  ];

  const displayCurrency = normalizeDisplayCurrency(product.currency);
  const currencyLabel = displayCurrency === 'GHS' ? 'Cedis (GH₵)' : displayCurrency;
  const priceLabel = product.price == null ? 'Price unavailable' : `${currencyLabel} ${product.price.toFixed(2)}`;
  const availabilityLabel =
    typeof product.stockCount === 'number' ? (product.stockCount > 0 ? 'In stock' : 'Out of stock') : undefined;

  return (
    <main className="productDetailPage">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="productDetailContent">
        <div className="productDetailMainColumn">
          <section className="productSummaryCard">
            {product.imageUrls.length > 0 ? (
              <section className="productImageGrid" aria-label="Product images">
                {product.imageUrls.map((imageUrl) => (
                  <Image
                    key={imageUrl}
                    src={imageUrl}
                    alt={product.imageAlt?.trim() || `${product.productName} at ${resolvedStoreName}`}
                    loading="lazy"
                    unoptimized
                    className="productDetailImage"
                    width={480}
                    height={480}
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ))}
              </section>
            ) : null}
            <div>
              <p className="eyebrow">Product details</p>
              <h1>{product.productName}</h1>
              <p className="productTrustLine">
                {isVerifiedStore ? <span className="verifiedBadge">Verified store</span> : null} 📍 {resolvedLocation} · 🚚 Delivery:
                Discuss with seller
              </p>
              {product.description ? (
                <FormattedDescription text={product.description} className="formattedDescription" />
              ) : (
                <p>No description available for this product yet.</p>
              )}
            </div>

            <div className="productStats">
              <p>
                <strong>Price:</strong> {priceLabel}
              </p>
              {hasSedifexDeal ? <p><strong>Sedifex online deal:</strong> Order through Sedifex to get this price.</p> : null}
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
            <p><strong>Contact:</strong> Order through Sedifex first to unlock direct store contact details.</p>

            <div className="productStoreActions">
              {hasStorePage ? (
                <Link href={storeHref ?? '#'}>View store details</Link>
              ) : null}
              <ShareButton
                className="secondaryButton"
                url={getProductHref(product.id, product.productName)}
                title={product.productName || 'Product on Sedifex'}
                text={`Check out ${product.productName || 'this product'} on Sedifex.`}
                label="Share product"
              />
              {hasWebsite ? (
                <a href={storeProfile?.websiteUrl} target="_blank" rel="noopener noreferrer">
                  Visit store website
                </a>
              ) : null}
            </div>
          </section>



          <section className="productStoreCard" aria-label="Why order through Sedifex">
            <h2>Why order through Sedifex?</h2>
            <ul>
              <li>Verified store listing</li>
              <li>Order receipt</li>
              <li>Payment record</li>
              <li>Store follow-up</li>
              <li>Sedifex support if there is an issue</li>
            </ul>
            {storePhoneHref ? <p className="checkoutHint">Need urgent help after placing an order? Call <a href={`tel:${storePhoneHref}`}>{resolvedStorePhone}</a>.</p> : null}
          </section>

          <ProductEngagementPanel
            publicProductId={product.id}
            storeId={product.storeId}
            sourceProductId={product.sourceProductId}
            isPublished={product.isPublished}
          />
          <RelatedMarketplaceItems
            currentItemId={product.id}
            currentStoreId={product.storeId}
            currentCategory={product.categoryKey}
            currentListingType={(product as { listingType?: string }).listingType ?? product.itemType}
            currentItemType={product.itemType}
            currentServiceKind={(product as { serviceKind?: string }).serviceKind}
            currentPrice={product.price}
            items={relatedPool}
          />
        </div>

        <ProductPurchasePanel
          productId={checkoutProductId}
          merchantId={product.storeId ?? ''}
          productName={product.productName}
          storeName={resolvedStoreName}
          itemType={product.itemType}
          price={product.price}
          currency={product.currency}
          imageUrl={product.imageUrls[0]}
        />
      </div>
    </main>
  );
}
