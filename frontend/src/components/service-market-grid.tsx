'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, documentId, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db, firebaseConfigError } from '@/lib/firebase';
import { getProductHref } from '@/lib/product-route';
import { getStoreHref } from '@/lib/store-route';

type PublicService = {
  id: string;
  storeId?: string;
  productName?: string;
  name?: string;
  description?: string;
  category?: string;
  categoryKey?: string;
  imageUrls?: string[] | string;
  imageUrl?: string;
  serviceImageUrls?: string[] | string;
  serviceImageUrl?: string;
  imageAlt?: string;
  price?: number;
  currency?: string;
  storeName?: string;
  storePhone?: string;
  city?: string;
  storeCity?: string;
  itemType?: string;
  type?: string;
  visible?: boolean | string | number;
  isVisible?: boolean | string | number;
  hidden?: boolean | string | number;
  isHidden?: boolean | string | number;
  deleted?: boolean | string | number;
  isDeleted?: boolean | string | number;
  publishedAt?: { seconds?: number };
  updatedAt?: { seconds?: number } | string;
};

const INITIAL_VISIBLE_COUNT = 24;
const LOAD_MORE_COUNT = 24;
const SERVICE_SCAN_LIMIT = 1000;
const VERIFIED_STORE_SCAN_LIMIT = 500;
const FIRST_SCREEN_PER_STORE_LIMIT = 4;

const normalizeBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return null;
};

const isExplicitlyTrue = (value: unknown) => normalizeBoolean(value) === true;
const isExplicitlyFalse = (value: unknown) => normalizeBoolean(value) === false;
const getServiceName = (item: PublicService) => (item.productName ?? item.name)?.trim() || 'Untitled service';
const getStoreCity = (item: PublicService) => (item.city ?? item.storeCity)?.trim() || 'City unavailable';

const isServiceItem = (item: PublicService) => {
  const normalizedType = (item.itemType ?? item.type ?? '').trim().toLowerCase();
  return normalizedType === 'service';
};

const isPublicListing = (item: PublicService) => {
  if (isExplicitlyTrue(item.deleted) || isExplicitlyTrue(item.isDeleted)) return false;
  if (isExplicitlyTrue(item.hidden) || isExplicitlyTrue(item.isHidden)) return false;
  if (isExplicitlyFalse(item.visible) || isExplicitlyFalse(item.isVisible)) return false;
  return true;
};

const decodeImageValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap((entry) => decodeImageValues(entry));
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.flatMap((entry) => decodeImageValues(entry));
    } catch {
      return [trimmed];
    }
  }
  return [trimmed];
};

const normalizeImageUrl = (value: string) => {
  const trimmed = value
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/');
  if (!trimmed.toLowerCase().startsWith('gs://')) return trimmed;
  const withoutPrefix = trimmed.slice(5);
  const slashIndex = withoutPrefix.indexOf('/');
  if (slashIndex === -1) return '';
  const bucket = withoutPrefix.slice(0, slashIndex);
  const objectPath = withoutPrefix.slice(slashIndex + 1);
  return bucket && objectPath ? `https://storage.googleapis.com/${bucket}/${objectPath}` : '';
};

const isValidImageUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const getDisplayImages = (item: PublicService) => {
  const candidates = [item.imageUrls, item.imageUrl, item.serviceImageUrls, item.serviceImageUrl].flatMap((value) =>
    decodeImageValues(value),
  );
  return Array.from(new Set(candidates.map(normalizeImageUrl).filter(isValidImageUrl)));
};

const normalizeDisplayCurrency = (currency?: string) => {
  const normalizedCurrency = (currency ?? 'GHS').toUpperCase();
  return normalizedCurrency === 'USD' ? 'GHS' : normalizedCurrency;
};

const formatPrice = (price?: number, currency?: string) => {
  if (price == null) return 'Ask store for pricing';
  const displayCurrency = normalizeDisplayCurrency(currency);
  const currencyLabel = displayCurrency === 'GHS' ? 'Cedis (GH₵)' : displayCurrency;
  return `${currencyLabel} ${price.toFixed(2)}`;
};

const getTimestampScore = (value: PublicService['updatedAt'] | PublicService['publishedAt']) => {
  if (!value) return 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed / 1000 : 0;
  }
  return typeof value.seconds === 'number' ? value.seconds : 0;
};

const getStoreKey = (item: PublicService) =>
  item.storeId?.trim() || item.storeName?.trim() || `unknown-store-${item.id}`;

const mixServicesAcrossStores = (items: PublicService[]) => {
  const buckets = new Map<string, PublicService[]>();
  for (const item of items) {
    const storeKey = getStoreKey(item);
    const bucket = buckets.get(storeKey) ?? [];
    bucket.push(item);
    buckets.set(storeKey, bucket);
  }

  const mixed: PublicService[] = [];
  while (buckets.size > 0) {
    for (const [storeKey, storeItems] of buckets) {
      const nextItem = storeItems.shift();
      if (nextItem) mixed.push(nextItem);
      if (storeItems.length === 0) buckets.delete(storeKey);
    }
  }
  return mixed;
};

const prioritizeBalancedFirstScreen = (items: PublicService[]) => {
  const firstScreenCounts = new Map<string, number>();
  const firstScreen: PublicService[] = [];
  const remaining: PublicService[] = [];

  for (const item of items) {
    const storeKey = getStoreKey(item);
    const count = firstScreenCounts.get(storeKey) ?? 0;
    if (count < FIRST_SCREEN_PER_STORE_LIMIT) {
      firstScreenCounts.set(storeKey, count + 1);
      firstScreen.push(item);
    } else {
      remaining.push(item);
    }
  }

  return [...firstScreen, ...remaining];
};

const getServiceApprovedStoreIds = async () => {
  if (!db) return new Set<string>();
  const snapshot = await getDocs(
    query(collection(db, 'stores'), where('verified', '==', true), limit(VERIFIED_STORE_SCAN_LIMIT)),
  );
  const ids = new Set<string>();

  snapshot.docs.forEach((storeDoc) => {
    const data = storeDoc.data() as Record<string, unknown>;
    const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
    const eligibleForBuy = normalizeBoolean(data.eligibleForBuy);
    const verifiedService = normalizeBoolean(data.verified_service ?? data.verifiedService);
    if (
      ['inactive', 'suspended', 'deleted', 'disabled'].includes(status) ||
      eligibleForBuy === false ||
      verifiedService === false
    )
      return;

    ids.add(storeDoc.id);
    for (const key of ['storeId', 'id', 'ownerUid', 'workspaceSlug']) {
      const value = data[key];
      if (typeof value === 'string' && value.trim()) ids.add(value.trim());
    }
  });

  return ids;
};

export function ServiceMarketGrid() {
  const [services, setServices] = useState<PublicService[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedCity, setSelectedCity] = useState('all');
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_COUNT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadServices = async () => {
      if (!db) {
        setError(firebaseConfigError ?? 'Firebase is not configured.');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        const [serviceApprovedStoreIds, snapshot] = await Promise.all([
          getServiceApprovedStoreIds(),
          getDocs(query(collection(db, 'publicProducts'), orderBy(documentId(), 'asc'), limit(SERVICE_SCAN_LIMIT))),
        ]);
        if (!active) return;

        const loaded = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PublicService)
          .filter((item) => {
            const storeId = item.storeId?.trim();
            return Boolean(
              storeId &&
              serviceApprovedStoreIds.has(storeId) &&
              isServiceItem(item) &&
              isPublicListing(item) &&
              getDisplayImages(item).length > 0,
            );
          })
          .sort((left, right) => {
            const leftTime = getTimestampScore(left.publishedAt) || getTimestampScore(left.updatedAt);
            const rightTime = getTimestampScore(right.publishedAt) || getTimestampScore(right.updatedAt);
            return rightTime - leftTime;
          });

        setServices(loaded);
      } catch (loadError) {
        console.error('Failed to load services', loadError);
        if (!active) return;
        setError('Could not load services. Check Firebase rules/indexes or try again.');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadServices();
    return () => {
      active = false;
    };
  }, []);

  const cities = useMemo(() => {
    const next = new Set<string>(['all']);
    services.forEach((item) => next.add(getStoreCity(item)));
    return Array.from(next).sort((a, b) => a.localeCompare(b));
  }, [services]);

  const filteredServices = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    const filtered = services.filter((service) => {
      const cityMatches = selectedCity === 'all' || getStoreCity(service).toLowerCase() === selectedCity.toLowerCase();
      if (!cityMatches) return false;
      if (!text) return true;
      const haystack = [
        getServiceName(service),
        service.description,
        service.storeName,
        service.category,
        service.categoryKey,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(text);
    });
    return prioritizeBalancedFirstScreen(mixServicesAcrossStores(filtered));
  }, [searchText, selectedCity, services]);

  const visibleServices = filteredServices.slice(0, visibleLimit);

  return (
    <section className="marketplace" aria-label="Verified services marketplace">
      <div className="toolbar">
        <div className="searchWrap">
          <label htmlFor="service-search">Search services</label>
          <input
            id="service-search"
            type="search"
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              setVisibleLimit(INITIAL_VISIBLE_COUNT);
            }}
            placeholder="Search services..."
          />
        </div>
        <div className="sortWrap">
          <label htmlFor="service-city-filter">City</label>
          <select
            id="service-city-filter"
            value={selectedCity}
            onChange={(event) => {
              setSelectedCity(event.target.value);
              setVisibleLimit(INITIAL_VISIBLE_COUNT);
            }}
          >
            {cities.map((city) => (
              <option key={city} value={city}>
                {city === 'all' ? 'All cities' : city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="grid">
        {isLoading
          ? Array.from({ length: 8 }).map((_, index) => (
              <article key={`service-skeleton-${index}`} className="card skeletonCard" aria-hidden="true">
                <div className="skeleton skeletonImage" />
                <div className="skeleton skeletonTitle" />
                <div className="skeleton skeletonText" />
                <div className="skeleton skeletonButton" />
              </article>
            ))
          : visibleServices.map((service) => {
              const imageUrl = getDisplayImages(service)[0] ?? 'https://placehold.co/640x640';
              const storeHref = getStoreHref(service.storeId, service.storeName);
              const description =
                (service.description ?? '')
                  .split(/\n+/)
                  .map((line) => line.trim())
                  .filter(Boolean)[0] ?? '';
              return (
                <article key={service.id} className="card">
                  <div className="imageWrap">
                    <Image
                      src={imageUrl}
                      alt={service.imageAlt?.trim() || getServiceName(service)}
                      loading="lazy"
                      unoptimized
                      width={360}
                      height={360}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      style={{ width: '100%', height: 'auto' }}
                    />
                  </div>
                  <h3>{getServiceName(service)}</h3>
                  <p className="productShortDescription">{description}</p>
                  <div className="meta">
                    <span className="storeIdentity">
                      {storeHref ? (
                        <Link href={storeHref}>{service.storeName ?? 'Unknown store'}</Link>
                      ) : (
                        (service.storeName ?? 'Unknown store')
                      )}
                      <span className="verifiedBadge" aria-label="Verified by Sedifex">
                        <span className="verifiedPulse" aria-hidden="true" />
                        Verified by Sedifex
                      </span>
                    </span>
                    <strong>{formatPrice(service.price, service.currency)}</strong>
                  </div>
                  <p className="trustScoreCard">📅 Book through Sedifex · Pay online or request support</p>
                  <div className="cardActions">
                    <Link
                      href={getProductHref(service.id, service.productName ?? service.name)}
                      className="buyNowButton"
                      aria-label={`Book ${getServiceName(service)}`}
                    >
                      Book service
                    </Link>
                    {storeHref ? (
                      <Link className="contactStoreButton" href={storeHref}>
                        View store
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
      </div>

      {!isLoading && filteredServices.length === 0 && !error ? (
        <div className="emptyState">
          <h3>No services found</h3>
          <p>Try a different search term or city.</p>
        </div>
      ) : null}

      <div className="actions">
        <button
          type="button"
          disabled={isLoading || visibleLimit >= filteredServices.length}
          onClick={() => setVisibleLimit((current) => current + LOAD_MORE_COUNT)}
        >
          {visibleLimit >= filteredServices.length ? 'All services loaded' : 'Load more services'}
        </button>
      </div>
    </section>
  );
}
