'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { getProductHref } from '@/lib/product-route';

type MarketplaceItem = {
  id: string;
  storeId?: string;
  storeName?: string;
  productName?: string;
  name?: string;
  categoryKey?: string;
  category?: string;
  marketCategory?: string;
  listingType?: string;
  itemType?: string;
  serviceKind?: string;
  salesMode?: string;
  price?: number;
  currency?: string;
  marketplaceEnabled?: boolean;
  public?: boolean;
  imageUrls?: string[];
  imageUrl?: string;
};

type RelatedMarketplaceItemsProps = {
  currentItemId: string;
  currentStoreId?: string;
  currentCategory?: string;
  currentListingType?: string;
  currentItemType?: string;
  currentServiceKind?: string;
  currentPrice?: number;
  items: MarketplaceItem[];
  title?: string;
  limit?: number;
};

const lower = (value?: string) => value?.trim().toLowerCase() ?? '';
const getName = (item: MarketplaceItem) => item.productName?.trim() || item.name?.trim() || 'Untitled item';
const getCategory = (item: MarketplaceItem) => item.categoryKey?.trim() || item.category?.trim() || item.marketCategory?.trim() || 'General';
const getImage = (item: MarketplaceItem) => item.imageUrls?.[0]?.trim() || item.imageUrl?.trim() || '';
const getBadge = (item: MarketplaceItem) => {
  const listingType = lower(item.listingType);
  if (listingType === 'course') return 'Course';
  if (listingType === 'event') return 'Event';
  if (listingType === 'service') return 'Service';
  return lower(item.itemType) === 'service' ? 'Service' : 'Product';
};

const getCta = (salesMode?: string) => {
  const mode = lower(salesMode);
  if (mode === 'buy_now') return 'Buy now';
  if (mode === 'book_now') return 'Book';
  if (mode === 'request_quote') return 'Request quote';
  if (mode === 'register') return 'Register';
  if (mode === 'get_ticket') return 'Get ticket';
  return 'View details';
};

export const getRelatedMarketplaceItems = (
  currentItem: RelatedMarketplaceItemsProps,
  allItems: MarketplaceItem[],
  options?: { limit?: number },
) => {
  const maxItems = options?.limit ?? currentItem.limit ?? 8;
  const currentListingType = lower(currentItem.currentListingType);
  const currentItemType = lower(currentItem.currentItemType);

  return allItems
    .map((item) => {
      let score = 0;
      const sameCategory = lower(getCategory(item)) === lower(currentItem.currentCategory);
      const sameListingType = lower(item.listingType) === currentListingType;
      const sameItemType = lower(item.itemType) === currentItemType;
      const sameServiceKind = lower(item.serviceKind) === lower(currentItem.currentServiceKind);
      const imageUrl = getImage(item);
      const hasImage = Boolean(imageUrl);
      const hasPrice = typeof item.price === 'number' && Number.isFinite(item.price);
      const saleNeedsPrice = ['buy_now', 'register', 'book_now'].includes(lower(item.salesMode));

      if (item.id === currentItem.currentItemId) score -= 100;
      if (item.marketplaceEnabled === false) score -= 100;
      if (item.public === false) score -= 100;
      if (!hasImage) score -= 50;
      if (!hasPrice && saleNeedsPrice) score -= 50;
      if (item.storeId && item.storeId === currentItem.currentStoreId) score += 50;
      if (sameCategory) score += 40;
      if (sameListingType) score += 35;
      if (sameItemType) score += 30;
      if (sameServiceKind) score += 25;
      if (currentItem.currentPrice && hasPrice) {
        const min = currentItem.currentPrice * 0.7;
        const max = currentItem.currentPrice * 1.3;
        if ((item.price ?? 0) >= min && (item.price ?? 0) <= max) score += 15;
      }
      if (hasImage) score += 10;
      if (hasPrice) score += 10;

      if (currentListingType === 'product' && lower(item.listingType) === 'product') score += 18;
      if (currentListingType === 'service' && lower(item.listingType) === 'service') score += 18;
      if (currentListingType === 'course' && lower(item.listingType) === 'course') score += 18;
      if (currentListingType === 'event' && lower(item.listingType) === 'event') score += 18;

      return { item, score };
    })
    .filter((entry) => entry.item.id !== currentItem.currentItemId && entry.score > -100)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map((entry) => entry.item);
};

export function RelatedMarketplaceItems(props: RelatedMarketplaceItemsProps) {
  const relatedItems = useMemo(() => getRelatedMarketplaceItems(props, props.items, { limit: props.limit ?? 8 }), [props]);

  const currentType = lower(props.currentListingType);
  const sectionTitles = {
    primary:
      currentType === 'service'
        ? 'Other services from this store'
        : currentType === 'course'
          ? 'Other courses'
          : currentType === 'event'
            ? 'Other upcoming classes/events'
            : 'Similar products',
    secondary:
      currentType === 'service'
        ? 'Similar services'
        : currentType === 'course'
          ? 'Upcoming batches'
          : currentType === 'event'
            ? 'Related courses'
            : 'More from this store',
    tertiary:
      currentType === 'service' ? 'You may also need' : currentType === 'course' ? 'Related training' : 'Complete your order',
  };

  const primaryItems = relatedItems.slice(0, 4);
  const secondaryItems = relatedItems.slice(4, 8);

  useEffect(() => {
    if (relatedItems.length === 0) return;
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'related_items_impression', payload: { currentItemId: props.currentItemId, currentStoreId: props.currentStoreId, count: relatedItems.length } }),
      keepalive: true,
    }).catch(() => undefined);
  }, [props.currentItemId, props.currentStoreId, relatedItems.length]);

  const trackClick = (clicked: MarketplaceItem, section: string, position: number) => {
    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventName: 'related_item_click', payload: { currentItemId: props.currentItemId, clickedItemId: clicked.id, currentStoreId: props.currentStoreId, clickedStoreId: clicked.storeId, section, position } }),
      keepalive: true,
    }).catch(() => undefined);
  };

  if (relatedItems.length === 0) {
    return <section className="storeInfoCard"><h2>Explore more on Sedifex Market</h2><p>Explore more products and services on Sedifex Market.</p></section>;
  }

  const renderCards = (title: string, sectionItems: MarketplaceItem[], offset: number) => (
    <section className="storeInfoCard" aria-label={title}>
      <h2>{title}</h2>
      <div className="grid">
        {sectionItems.map((item, index) => {
          const imageUrl = getImage(item) || 'https://placehold.co/640x640';
          return (
            <article key={`${title}-${item.id}`} className="card">
              <div className="imageWrap"><Image src={imageUrl} alt={getName(item)} width={360} height={360} unoptimized style={{ width: '100%', height: 'auto' }} /></div>
              <p className="eyebrow">{getBadge(item)}</p>
              <h3>{getName(item)}</h3>
              <p>{item.storeName || 'Unknown store'} · {getCategory(item)}</p>
              <p>{typeof item.price === 'number' ? `${(item.currency || 'GHS').toUpperCase()} ${item.price.toFixed(2)}` : 'Price unavailable'}</p>
              <div className="cardActions">
                <Link className="requestButton" href={getProductHref(item.id, getName(item))} onClick={() => trackClick(item, title, offset + index + 1)}>{getCta(item.salesMode)}</Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );

  return (
    <div>
      {props.title ? <h2>{props.title}</h2> : null}
      {renderCards(sectionTitles.primary, primaryItems, 0)}
      {secondaryItems.length > 0 ? renderCards(sectionTitles.secondary, secondaryItems, 4) : null}
      {relatedItems.length < 4 ? <section className="storeInfoCard"><h2>Explore more on Sedifex Market</h2></section> : null}
      {currentType === 'product' || currentType === 'service' || currentType === 'course' ? (
        renderCards(sectionTitles.tertiary, relatedItems.slice(0, Math.min(4, relatedItems.length)), 0)
      ) : null}
    </div>
  );
}
