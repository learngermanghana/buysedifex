import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FormattedDescription } from '@/components/formatted-description';
import { ShareButton } from '@/components/share-button';
import { ProductPurchasePanel } from '@/components/product-purchase-panel';
import { ServiceBookingPanel } from '@/components/service-booking-panel';
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

const normalizedValues = (input: { itemType?: string; listingType?: string; serviceKind?: string; salesMode?: string }) =>
  [input.itemType, input.listingType, input.serviceKind, input.salesMode].map((v) => (v ?? '').trim().toLowerCase());

const isCourseLikeItem = (input: { itemType?: string; listingType?: string; serviceKind?: string; salesMode?: string }) =>
  normalizedValues(input).some((value) => ['course', 'class', 'training', 'registration', 'course_enrollment'].includes(value));

const isServiceLikeItem = (input: { itemType?: string; listingType?: string; serviceKind?: string; salesMode?: string }) => {
  const values = normalizedValues(input);
  return values.some((value) => ['service', 'course', 'event', 'appointment', 'booking', 'class', 'training', 'registration', 'course_enrollment'].includes(value));
};

const buildBookingExplainer = (input: { isCourse: boolean; storeName: string; hasWebsite: boolean }) => {
  if (input.isCourse) {
    return {
      title: 'How to register',
      heading: 'Register through the school website',
      body: `Visit ${input.storeName} website, open the registration or courses page, select this course, and complete your application or payment online. Online registrations and payments are connected to Sedifex, so the school receives your details automatically.`,
      steps: ['Visit the school website.', 'Open Registration, Courses, or Apply.', 'Select this course.', 'Submit your application or payment online.', 'The school receives your details through Sedifex.'],
      websiteLabel: 'Visit school website',
      missingWebsite: 'This school has not added a website link yet. Use the Sedifex request option on this page.',
    };
  }

  return {
    title: 'How to book',
    heading: 'Book through the business website',
    body: `Visit ${input.storeName} website, open the booking or services page, select this service, and complete your booking or payment online. Online bookings and payments are connected to Sedifex, so the business receives your request automatically.`,
    steps: ['Visit the business website.', 'Open Booking, Services, or Appointments.', 'Select this service.', 'Submit your booking or payment online.', 'The business receives your request through Sedifex.'],
    websiteLabel: 'Visit business website',
    missingWebsite: 'This business has not added a website link yet. Use the Sedifex request option on this page.',
  };
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
  const productListingType = (product as { listingType?: string }).listingType;
  const productServiceKind = (product as { serviceKind?: string }).serviceKind;
  const serviceLike = isServiceLikeItem({ itemType: product.itemType, listingType: productListingType, serviceKind: productServiceKind, salesMode: (product as { salesMode?: string }).salesMode });
  const courseLike = isCourseLikeItem({ itemType: product.itemType, listingType: productListingType, serviceKind: productServiceKind, salesMode: (product as { salesMode?: string }).salesMode });
  const bookingExplainer = serviceLike ? buildBookingExplainer({ isCourse: courseLike, storeName: resolvedStoreName, hasWebsite }) : null;

  const [sameStoreSameCategory, sameCategoryMarketplace, sameStoreItems, marketplaceFallback] = await Promise.all([
    listIntegrationProducts({
      storeId: product.storeId,
      categoryKey: product.categoryKey,
      pageSize: 12,
      sort: 'latest',
    }).catch(() => ({ items: [] })),
    listIntegrationProducts({
      categoryKey: product.categoryKey,
      pageSize: 24,
      sort: 'store-diverse',
    }).catch(() => ({ items: [] })),
    listIntegrationProducts({
      storeId: product.storeId,
      pageSize: 24,
      sort: 'latest',
    }).catch(() => ({ items: [] })),
    listIntegrationProducts({
      page: 1,
      pageSize: 60,
      sort: 'store-diverse',
    }).catch(() => ({ items: [] })),
  ]);

  const relatedPool = Array.from(
    new Map(
      [
        ...sameStoreSameCategory.items,
        ...sameCategoryMarketplace.items,
        ...sameStoreItems.items,
        ...marketplaceFallback.items,
      ]
        .filter((item) => item.id && item.id !== product.id)
        .map((item) => [item.id, item]),
    ).values(),
  ).map((item) => ({
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
              <h1>{product.productName}</h1>
              <p className="productTrustLine">
                <strong>{resolvedStoreName}</strong> {isVerifiedStore ? <span className="verifiedBadge">Verified store</span> : null}
              </p>
            </div>

            <div className="productStats">
              <p className="productPriceLine">{priceLabel}</p>
              {hasSedifexDeal ? <p><strong>Sedifex online deal:</strong> Order through Sedifex to get this price.</p> : null}
              <p className="productTrustMessage">
                {serviceLike
                  ? `Online ${courseLike ? 'registrations' : 'bookings'} and payments are powered by Sedifex when completed through the ${courseLike ? 'school' : 'business'} website or Sedifex Market.`
                  : 'Verified checkout and payment record on Sedifex.'}
              </p>
              {availabilityLabel && !serviceLike ? (
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

            {bookingExplainer ? (
              <section className="productContentSection bookingExplainerCard" aria-label={bookingExplainer.title}>
                <p className="eyebrow">{bookingExplainer.title}</p>
                <h2>{bookingExplainer.heading}</h2>
                <p>{bookingExplainer.body}</p>
                <ol>
                  {bookingExplainer.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
                {hasWebsite ? (
                  <a className="requestButton bookingExplainerButton" href={storeProfile?.websiteUrl} target="_blank" rel="noopener noreferrer">
                    {bookingExplainer.websiteLabel}
                  </a>
                ) : (
                  <p className="requestFeedback error">{bookingExplainer.missingWebsite}</p>
                )}
              </section>
            ) : null}

            <section className="productContentSection" aria-label="About this product">
              <h2>{serviceLike ? `About this ${courseLike ? 'course' : 'service'}` : 'About this product'}</h2>
              {product.description ? (
                <FormattedDescription text={product.description} className="formattedDescription" />
              ) : (
                <p>No description available for this {serviceLike ? (courseLike ? 'course' : 'service') : 'product'} yet.</p>
              )}
            </section>
          </section>

          <section className="productStoreCard" aria-label="Store contact details">
            <h2>{courseLike ? 'School information' : serviceLike ? 'Business information' : 'Store information'}</h2>
            <p>
              <strong>Name:</strong> {resolvedStoreName}{' '}
              {isVerifiedStore ? <span className="verifiedBadge">Verified</span> : null}
            </p>
            <p>
              <strong>Location:</strong> {resolvedLocation}
            </p>
            <p>
              <strong>Sedifex connection:</strong>{' '}
              {serviceLike
                ? `This ${courseLike ? 'school' : 'business'} can use Sedifex to manage online ${courseLike ? 'registrations' : 'bookings'}, payments, and records.`
                : 'Order through Sedifex first to unlock direct store contact details.'}
            </p>

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
                  {courseLike ? 'Visit school website' : serviceLike ? 'Visit business website' : 'Visit store website'}
                </a>
              ) : null}
            </div>
          </section>

          <section className="productStoreCard productWhyCard" aria-label={serviceLike ? 'Why use Sedifex powered booking' : 'Why order through Sedifex'}>
            <h2>{serviceLike ? `Why ${courseLike ? 'register' : 'book'} through a Sedifex-powered channel` : 'Why buy on Sedifex'}</h2>
            {serviceLike ? (
              <ul>
                <li>Verified {courseLike ? 'school' : 'business'} listing</li>
                <li>{courseLike ? 'Registration' : 'Booking'} and payment records when completed online</li>
                <li>Details are communicated to the {courseLike ? 'school' : 'business'} automatically</li>
                <li>Cleaner follow-up between customer and {courseLike ? 'school' : 'business'}</li>
                <li>Sedifex support if the online request has an issue</li>
              </ul>
            ) : (
              <ul>
                <li>Verified store listing</li>
                <li>Order receipt</li>
                <li>Payment record</li>
                <li>Store follow-up</li>
                <li>Sedifex support if there is an issue</li>
              </ul>
            )}
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
            currentListingType={productListingType ?? product.itemType}
            currentItemType={product.itemType}
            currentServiceKind={productServiceKind}
            currentPrice={product.price}
            items={relatedPool}
          />
        </div>

        {serviceLike ? (
          <ServiceBookingPanel
            productId={checkoutProductId}
            merchantId={product.storeId ?? ''}
            productName={product.productName}
            price={product.price}
            currency={product.currency}
            whatsappPhone={storeProfile?.storeWhatsapp ?? storeProfile?.storePhone ?? product.waLink}
            storeName={resolvedStoreName}
            storeWebsiteUrl={storeProfile?.websiteUrl}
            listingType={productListingType}
            itemType={product.itemType}
          />
        ) : (
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
        )}
      </div>
    </main>
  );
}
