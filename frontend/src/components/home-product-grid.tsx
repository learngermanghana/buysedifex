'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, documentId, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db, firebaseConfigError } from '@/lib/firebase';
import { getProductHref } from '@/lib/product-route';
import { getStoreHref } from '@/lib/store-route';
import { resolveClosestCategoryKey } from '@/lib/category-taxonomy';

type PublicProduct = {
  id: string;
  storeId?: string;
  productName?: string;
  name?: string;
  description?: string;
  categoryKey?: string;
  category?: string;
  imageUrls?: string[] | string;
  imageUrl?: string;
  image?: string;
  serviceImageUrl?: string;
  serviceImage?: string;
  serviceImageUrls?: string[] | string;
  thumbnailUrl?: string;
  photoUrl?: string;
  images?: string[] | string;
  imageAlt?: string;
  price?: number;
  currency?: string;
  sku?: string;
  batchNumber?: string;
  storeName?: string;
  storePhone?: string;
  phone?: string;
  telephone?: string;
  city?: string;
  storeCity?: string;
  itemType?: string;
  type?: string;
  isVisible?: boolean | string | number;
  visible?: boolean | string | number;
  isPublished?: boolean | string | number;
  hidden?: boolean | string | number;
  isHidden?: boolean | string | number;
  deleted?: boolean | string | number;
  isDeleted?: boolean | string | number;
  verified?: boolean | string | number;
  featuredRank?: number;
  rankingScore?: number;
  publishedAt?: { seconds?: number };
  updatedAt?: { seconds?: number } | string;
};

type SortOption = 'newest' | 'price' | 'featured';

const INITIAL_VISIBLE_COUNT = 24;
const LOAD_MORE_COUNT = 24;
const HOME_SCAN_LIMIT = 1000;
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

const isExplicitlyFalse = (value: unknown) => normalizeBoolean(value) === false;
const isExplicitlyTrue = (value: unknown) => normalizeBoolean(value) === true;
const getProductName = (item: PublicProduct) => (item.productName ?? item.name)?.trim() || 'Untitled item';

const getCategory = (item: PublicProduct) =>
  resolveClosestCategoryKey({
    category: item.categoryKey?.trim() || item.category?.trim(),
    productName: getProductName(item),
    description: item.description,
    itemType: item.itemType,
  });

const getStoreCity = (item: PublicProduct) => (item.city ?? item.storeCity)?.trim() || 'City unavailable';

const normalizeDisplayCurrency = (currency?: string) => {
  const normalizedCurrency = (currency ?? 'GHS').toUpperCase();
  return normalizedCurrency === 'USD' ? 'GHS' : normalizedCurrency;
};

const formatPrice = (price?: number, currency?: string) => {
  if (price == null) return 'Price unavailable';
  const displayCurrency = normalizeDisplayCurrency(currency);
  const currencyLabel = displayCurrency === 'GHS' ? 'Cedis (GH₵)' : displayCurrency;
  return `${currencyLabel} ${price.toFixed(2)}`;
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

const normalizeImageUrl = (value: string): string => {
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

const getDisplayImages = (item: PublicProduct): string[] => {
  const candidates = [
    item.imageUrls,
    item.imageUrl,
    item.image,
    item.serviceImageUrls,
    item.serviceImageUrl,
    item.serviceImage,
    item.thumbnailUrl,
    item.photoUrl,
    item.images,
  ].flatMap((value) => decodeImageValues(value));
  return Array.from(new Set(candidates.map(normalizeImageUrl).filter(isValidImageUrl)));
};

const isProductItem = (item: PublicProduct) => {
  const normalizedType = (item.itemType ?? item.type ?? 'product').trim().toLowerCase();
  return normalizedType !== 'service';
};

const isPublicListing = (item: PublicProduct) => {
  if (isExplicitlyTrue(item.deleted) || isExplicitlyTrue(item.isDeleted)) return false;
  if (isExplicitlyTrue(item.hidden) || isExplicitlyTrue(item.isHidden)) return false;
  if (isExplicitlyFalse(item.visible) || isExplicitlyFalse(item.isVisible)) return false;
  return true;
};

const isVerifiedStore = () => true;

const getContactPhone = (item: PublicProduct) => {
  const source = item as Record<string, unknown>;
  for (const key of ['phone', 'storePhone', 'telephone', 'whatsappNumber', 'mobile']) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

const getWhatsAppHref = (item: PublicProduct) => {
  const phone = getContactPhone(item).replace(/[^\d]/g, '');
  if (!phone) return '';
  const productLabel = getProductName(item);
  const storeLabel = item.storeName?.trim() || 'this shop';
  const message = encodeURIComponent(`Hi ${storeLabel}, I'm interested in the ${productLabel} I saw on Sedifex Market.`);
  return `https://wa.me/${phone}?text=${message}`;
};

const getTimestampScore = (value: PublicProduct['updatedAt'] | PublicProduct['publishedAt']) => {
  if (!value) return 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed / 1000 : 0;
  }
  return typeof value.seconds === 'number' ? value.seconds : 0;
};

const sortProducts = (items: PublicProduct[], selectedSort: SortOption) => {
  const sorted = [...items];
  sorted.sort((left, right) => {
    if (selectedSort === 'price') {
      const leftPrice = typeof left.price === 'number' ? left.price : Number.POSITIVE_INFINITY;
      const rightPrice = typeof right.price === 'number' ? right.price : Number.POSITIVE_INFINITY;
      if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    }
    if (selectedSort === 'featured') {
      const leftScore = typeof left.rankingScore === 'number' ? left.rankingScore : Number.NEGATIVE_INFINITY;
      const rightScore = typeof right.rankingScore === 'number' ? right.rankingScore : Number.NEGATIVE_INFINITY;
      if (leftScore !== rightScore) return rightScore - leftScore;
      const leftRank = typeof left.featuredRank === 'number' ? left.featuredRank : Number.NEGATIVE_INFINITY;
      const rightRank = typeof right.featuredRank === 'number' ? right.featuredRank : Number.NEGATIVE_INFINITY;
      if (leftRank !== rightRank) return rightRank - leftRank;
    }
    const leftTime = getTimestampScore(left.publishedAt) || getTimestampScore(left.updatedAt);
    const rightTime = getTimestampScore(right.publishedAt) || getTimestampScore(right.updatedAt);
    if (leftTime !== rightTime) return rightTime - leftTime;
    return left.id.localeCompare(right.id);
  });
  return sorted;
};

const getStoreKey = (item: PublicProduct) => item.storeId?.trim() || item.storeName?.trim() || `unknown-store-${item.id}`;

const mixProductsAcrossStores = (items: PublicProduct[]) => {
  const buckets = new Map<string, PublicProduct[]>();
  for (const item of items) {
    const storeKey = getStoreKey(item);
    const bucket = buckets.get(storeKey) ?? [];
    bucket.push(item);
    buckets.set(storeKey, bucket);
  }

  const mixed: PublicProduct[] = [];
  while (buckets.size > 0) {
    for (const [storeKey, storeItems] of buckets) {
      const nextItem = storeItems.shift();
      if (nextItem) mixed.push(nextItem);
      if (storeItems.length === 0) buckets.delete(storeKey);
    }
  }
  return mixed;
};

const prioritizeBalancedFirstScreen = (items: PublicProduct[]) => {
  const firstScreenCounts = new Map<string, number>();
  const firstScreen: PublicProduct[] = [];
  const remaining: PublicProduct[] = [];

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

const getProductApprovedStoreIds = async () => {
  if (!db) return new Set<string>();

  const snapshot = await getDocs(query(collection(db, 'stores'), where('verified', '==', true), limit(VERIFIED_STORE_SCAN_LIMIT)));
  const ids = new Set<string>();

  snapshot.docs.forEach((storeDoc) => {
    const data = storeDoc.data() as Record<string, unknown>;
    const status = typeof data.status === 'string' ? data.status.trim().toLowerCase() : '';
    const eligibleForBuy = normalizeBoolean(data.eligibleForBuy);
    const isInactive = ['inactive', 'suspended', 'deleted', 'disabled'].includes(status);
    const verifiedProduct = normalizeBoolean(data.verified_product ?? data.verifiedProduct);

    if (isInactive || eligibleForBuy === false || verifiedProduct === false) return;

    ids.add(storeDoc.id);
    for (const key of ['storeId', 'id', 'ownerUid', 'workspaceSlug']) {
      const value = data[key];
      if (typeof value === 'string' && value.trim()) ids.add(value.trim());
    }
  });

  return ids;
};

export function HomeProductGrid() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedSort, setSelectedSort] = useState<SortOption>('newest');
  const [searchText, setSearchText] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_COUNT);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      if (!db) {
        setError(firebaseConfigError ?? 'Firebase is not configured.');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        setError(null);
        const [productApprovedStoreIds, snapshot] = await Promise.all([
          getProductApprovedStoreIds(),
          getDocs(query(collection(db, 'publicProducts'), orderBy(documentId(), 'asc'), limit(HOME_SCAN_LIMIT))),
        ]);
        if (!active) return;
        const loaded = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PublicProduct)
          .filter((item) => {
            const storeId = item.storeId?.trim();
            return Boolean(
              storeId &&
                productApprovedStoreIds.has(storeId) &&
                isProductItem(item) &&
                isPublicListing(item) &&
                getDisplayImages(item).length > 0,
            );
          })
          .map((item) => ({ ...item, verified: true }));
        setProducts(loaded);
      } catch (err) {
        console.error('Failed to load homepage products', err);
        if (!active) return;
        setError('Could not load products. Check Firebase rules/indexes or try again.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadProducts();
    return () => {
      active = false;
    };
  }, []);

  const cities = useMemo(() => {
    const next = new Set<string>(['all']);
    products.forEach((item) => next.add(getStoreCity(item)));
    return Array.from(next).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    const filtered = products.filter((product) => {
      const cityMatches = selectedCity === 'all' || getStoreCity(product).toLowerCase() === selectedCity.toLowerCase();
      if (!cityMatches) return false;
      if (!text) return true;
      const haystack = [getProductName(product), product.description, product.storeName, getCategory(product), product.sku, product.batchNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(text);
    });
    return prioritizeBalancedFirstScreen(mixProductsAcrossStores(sortProducts(filtered, selectedSort)));
  }, [products, searchText, selectedCity, selectedSort]);

  const visibleProducts = filteredProducts.slice(0, visibleLimit);

  return (
    <section className="marketplace">
      <div className="toolbar">
        <div className="searchWrap">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="search"
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              setVisibleLimit(INITIAL_VISIBLE_COUNT);
            }}
            placeholder="Search products, stores, or categories"
          />
        </div>
        <div className="sortWrap">
          <label htmlFor="sort">Sort by</label>
          <select
            id="sort"
            value={selectedSort}
            onChange={(event) => {
              setSelectedSort(event.target.value as SortOption);
              setVisibleLimit(INITIAL_VISIBLE_COUNT);
            }}
          >
            <option value="featured">Popular</option>
            <option value="newest">Newest</option>
            <option value="price">Cheapest</option>
          </select>
        </div>
      </div>

      <div className="toolbar">
        <div className="sortWrap">
          <label htmlFor="city-filter">City</label>
          <select
            id="city-filter"
            value={selectedCity}
            onChange={(event) => {
              setSelectedCity(event.target.value);
              setVisibleLimit(INITIAL_VISIBLE_COUNT);
            }}
          >
            {cities.map((city) => (
              <option key={city} value={city}>{city === 'all' ? 'All cities' : city}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="grid">
        {isLoading
          ? Array.from({ length: 8 }).map((_, index) => (
              <article key={`skeleton-${index}`} className="card skeletonCard" aria-hidden="true">
                <div className="skeleton skeletonImage" />
                <div className="skeleton skeletonTitle" />
                <div className="skeleton skeletonText" />
                <div className="skeleton skeletonText short" />
                <div className="skeleton skeletonButton" />
              </article>
            ))
          : visibleProducts.map((item) => {
              const storeHref = getStoreHref(item.storeId, item.storeName);
              const whatsAppHref = getWhatsAppHref(item);
              const imageUrl = getDisplayImages(item)[0] ?? 'https://placehold.co/640x640';
              const shortDescription = (item.description ?? '').split(/\n+/).map((line) => line.trim()).filter(Boolean)[0] ?? '';
              return (
                <article key={item.id} className="card">
                  <div className="imageWrap">
                    <Image
                      src={imageUrl}
                      alt={item.imageAlt?.trim() || getProductName(item) || 'Product image'}
                      loading="lazy"
                      unoptimized
                      width={360}
                      height={360}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      style={{ width: '100%', height: 'auto' }}
                    />
                  </div>
                  <h3>{getProductName(item)}</h3>
                  <p className="productShortDescription">{shortDescription}</p>
                  <div className="meta">
                    <span className="storeIdentity">
                      {storeHref ? <Link href={storeHref}>{item.storeName ?? 'Unknown store'}</Link> : item.storeName ?? 'Unknown store'}
                      {isVerifiedStore() ? <span className="verifiedBadge" aria-label="Verified by Sedifex"><span className="verifiedPulse" aria-hidden="true" />Verified by Sedifex</span> : null}
                    </span>
                    <strong>{formatPrice(item.price, item.currency)}</strong>
                  </div>
                  {isVerifiedStore() ? <p className="trustScoreCard">🛡 Sedifex Trust+ 98%</p> : null}
                  <div className="cardActions">
                    <Link href={getProductHref(item.id, item.productName)} className="buyNowButton" aria-label={`Buy ${getProductName(item)} now`}>Buy now</Link>
                    {whatsAppHref ? <a className="contactStoreButton" href={whatsAppHref} target="_blank" rel="noopener noreferrer">Contact store</a> : <span className="contactStoreButton" aria-disabled="true">Contact store unavailable</span>}
                  </div>
                </article>
              );
            })}
      </div>

      {!isLoading && visibleProducts.length === 0 && !error ? <div className="emptyState"><h3>No products found</h3><p>Try a different search term, category, or city.</p></div> : null}

      <div className="actions">
        <button type="button" disabled={isLoading || visibleLimit >= filteredProducts.length} onClick={() => setVisibleLimit((current) => current + LOAD_MORE_COUNT)}>
          {visibleLimit >= filteredProducts.length ? 'All products loaded' : 'Load more products'}
        </button>
      </div>
    </section>
  );
}
