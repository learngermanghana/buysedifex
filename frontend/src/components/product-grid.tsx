'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FirestoreError,
  QueryConstraint,
  QueryDocumentSnapshot,
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db, firebaseConfigError } from '@/lib/firebase';
import { FormattedDescription } from '@/components/formatted-description';
import { WhatsAppChatButton } from '@/components/whatsapp-chat-button';
import { getStoreHref } from '@/lib/store-route';
import { getProductHref } from '@/lib/product-route';
import { CANONICAL_CATEGORY_KEYS, resolveClosestCategoryKey } from '@/lib/category-taxonomy';

type PublicProduct = {
  id: string;
  storeId?: string;
  productName?: string;
  name?: string;
  description?: string;
  categoryKey?: string;
  category?: string;
  imageUrls?: string[];
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
  isVisible?: boolean;
  verified?: boolean | string;
  featuredRank?: number;
  rankingScore?: number;
  publishedAt?: { seconds: number };
  isPublished?: boolean;
};

type SortOption = 'newest' | 'price' | 'featured';
type ItemTypeFilter = 'all' | 'product' | 'service';

const PAGE_SIZE = 12;
const FETCH_SCAN_BATCHES = 4;
const SEARCH_SCAN_LIMIT = 300;
const SEARCH_BATCH_SIZE = 100;

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

const getContactPhone = (item: PublicProduct) => {
  const source = item as Record<string, unknown>;
  const candidateKeys = ['phone', 'storePhone', 'telephone', 'whatsappNumber', 'mobile'];

  for (const key of candidateKeys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }

  return '';
};

const buildWhatsAppMessage = (item: PublicProduct) => {
  const productLabel = (item.productName ?? item.name)?.trim() || 'this item';
  const storeLabel = item.storeName?.trim() || 'this shop';
  return `Hi ${storeLabel}, I'm interested in the ${productLabel} I saw on Sedifex Market.`;
};

const getProductName = (item: PublicProduct) => (item.productName ?? item.name)?.trim() || 'Untitled item';
const getCategory = (item: PublicProduct) =>
  resolveClosestCategoryKey({
    category: item.categoryKey?.trim() || item.category?.trim(),
    productName: getProductName(item),
    description: item.description,
    itemType: item.itemType,
  });

const getStorePhone = (item: PublicProduct) => getContactPhone(item) || 'Phone unavailable';

const getStoreCity = (item: PublicProduct) => {
  const rawCity = item.city ?? item.storeCity;
  return rawCity?.trim() || 'City unavailable';
};

const hasDisplayImage = (item: PublicProduct) => Array.isArray(item.imageUrls) && item.imageUrls.some((url) => Boolean(url?.trim()));
const isPublicListing = (item: PublicProduct) => item.isVisible === true || item.isPublished === true;

const isVerifiedStore = (value: PublicProduct['verified']) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
};

const normalizeStoreNamesByStoreId = (items: PublicProduct[]): PublicProduct[] => {
  const canonicalNamesByStoreId = new Map<string, string>();

  items.forEach((item) => {
    const storeId = item.storeId?.trim();
    const storeName = item.storeName?.trim();
    if (!storeId || !storeName) return;
    if (!canonicalNamesByStoreId.has(storeId)) {
      canonicalNamesByStoreId.set(storeId, storeName);
    }
  });

  return items.map((item) => {
    const storeId = item.storeId?.trim();
    if (!storeId) return item;

    const canonicalStoreName = canonicalNamesByStoreId.get(storeId);
    if (!canonicalStoreName || canonicalStoreName === item.storeName) return item;
    return { ...item, storeName: canonicalStoreName };
  });
};

const bucketProductsByStore = (items: PublicProduct[]) => {
  const buckets = new Map<string, PublicProduct[]>();

  items.forEach((item) => {
    const storeKey = item.storeId?.trim() || item.storeName?.trim() || `unknown-store-${item.id}`;
    const bucket = buckets.get(storeKey);

    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(storeKey, [item]);
    }
  });

  return buckets;
};

const shuffleProducts = (items: PublicProduct[]) => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const hold = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = hold;
  }

  return shuffled;
};

const mixProductsAcrossStores = (items: PublicProduct[]) => {
  const buckets = bucketProductsByStore(items);
  const mixed: PublicProduct[] = [];

  while (buckets.size > 0) {
    for (const [storeKey, storeItems] of buckets) {
      const nextItem = storeItems.shift();

      if (nextItem) {
        mixed.push(nextItem);
      }

      if (storeItems.length === 0) {
        buckets.delete(storeKey);
      }
    }
  }

  return mixed;
};

const mixProductsByCategoryThenStore = (items: PublicProduct[]) => {
  const categoryBuckets = new Map<string, PublicProduct[]>();

  items.forEach((item) => {
    const categoryKey = getCategory(item) || 'uncategorized';
    const bucket = categoryBuckets.get(categoryKey);

    if (bucket) {
      bucket.push(item);
    } else {
      categoryBuckets.set(categoryKey, [item]);
    }
  });

  const mixedByCategory: PublicProduct[] = [];
  for (const categoryItems of categoryBuckets.values()) {
    mixedByCategory.push(...mixProductsAcrossStores(categoryItems));
  }

  return mixedByCategory;
};

const selectStoreBalancedProducts = (items: PublicProduct[], count: number) => {
  if (items.length <= count) return items;
  const randomized = shuffleProducts(items);
  return mixProductsAcrossStores(randomized).slice(0, count);
};

const getPublishedAtSeconds = (item: PublicProduct) => {
  const seconds = item.publishedAt?.seconds;
  return typeof seconds === 'number' ? seconds : 0;
};

const sortProducts = (items: PublicProduct[], selectedSort: SortOption) => {
  const sorted = [...items];

  sorted.sort((left, right) => {
    if (selectedSort === 'price') {
      const leftPrice = typeof left.price === 'number' ? left.price : Number.POSITIVE_INFINITY;
      const rightPrice = typeof right.price === 'number' ? right.price : Number.POSITIVE_INFINITY;
      if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    } else if (selectedSort === 'featured') {
      const leftScore = typeof left.rankingScore === 'number' ? left.rankingScore : Number.NEGATIVE_INFINITY;
      const rightScore = typeof right.rankingScore === 'number' ? right.rankingScore : Number.NEGATIVE_INFINITY;
      if (leftScore !== rightScore) return rightScore - leftScore;

      const leftFeaturedRank = typeof left.featuredRank === 'number' ? left.featuredRank : Number.NEGATIVE_INFINITY;
      const rightFeaturedRank = typeof right.featuredRank === 'number' ? right.featuredRank : Number.NEGATIVE_INFINITY;
      if (leftFeaturedRank !== rightFeaturedRank) return rightFeaturedRank - leftFeaturedRank;
    } else {
      const leftPublishedAt = getPublishedAtSeconds(left);
      const rightPublishedAt = getPublishedAtSeconds(right);
      if (leftPublishedAt !== rightPublishedAt) return rightPublishedAt - leftPublishedAt;
    }

    return left.id.localeCompare(right.id);
  });

  return sorted;
};

type ProductGridProps = {
  itemTypeFilter?: ItemTypeFilter;
};

const matchesItemTypeFilter = (itemType: string | undefined, filter: ItemTypeFilter) => {
  if (filter === 'all') return true;
  const normalized = itemType?.trim().toLowerCase();
  if (filter === 'service') return normalized === 'service';
  return normalized !== 'service';
};

export function ProductGrid({ itemTypeFilter = 'all' }: ProductGridProps) {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [cities, setCities] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<SortOption>('newest');
  const [searchText, setSearchText] = useState<string>('');
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set());

  const hydrateVerifiedFromStores = useCallback(async (items: PublicProduct[]): Promise<PublicProduct[]> => {
    const storeIds = Array.from(
      new Set(items.map((item) => item.storeId?.trim()).filter((storeId): storeId is string => Boolean(storeId))),
    );

    if (storeIds.length === 0 || !db) {
      return items;
    }

    const verifiedByStoreId = new Map<string, boolean>();

    for (let index = 0; index < storeIds.length; index += 10) {
      const chunk = storeIds.slice(index, index + 10);
      const storesSnapshot = await getDocs(
        query(collection(db, 'stores'), where(documentId(), 'in', chunk), limit(chunk.length)),
      );

      storesSnapshot.docs.forEach((storeDoc) => {
        const storeData = storeDoc.data() as { verified?: boolean | string };
        verifiedByStoreId.set(storeDoc.id, isVerifiedStore(storeData.verified));
      });
    }

    return items.map((item) => {
      const storeId = item.storeId?.trim();
      if (!storeId) return item;
      if (!verifiedByStoreId.has(storeId)) return item;
      return { ...item, verified: verifiedByStoreId.get(storeId) === true };
    });
  }, []);

  const visibleProducts = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    const normalizedProducts = normalizeStoreNamesByStoreId(products);
    const matchingProducts = normalizedProducts.filter((product) => {
      const typeMatches = matchesItemTypeFilter(product.itemType, itemTypeFilter);
      if (!typeMatches) return false;
      const cityMatches = selectedCity === 'all' || getStoreCity(product).toLowerCase() === selectedCity.toLowerCase();
      if (!cityMatches) return false;
      const categoryMatches = selectedCategory === 'all' || getCategory(product) === selectedCategory;
      if (!categoryMatches) return false;
      if (!text) return true;
      const haystack = [
        getProductName(product),
        product.description,
        product.storeName,
        getCategory(product),
        product.sku,
        product.batchNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(text);
    });

    const imageReadyProducts = matchingProducts.filter(
      (product) => isPublicListing(product) && hasDisplayImage(product) && isVerifiedStore(product.verified),
    );
    const sortedProducts = sortProducts(imageReadyProducts, selectedSort);
    return mixProductsByCategoryThenStore(sortedProducts);
  }, [itemTypeFilter, products, searchText, selectedCategory, selectedCity, selectedSort]);

  const toggleDescription = (productId: string) => {
    setExpandedDescriptionIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    setCategories(['all', ...CANONICAL_CATEGORY_KEYS]);
    setIsLoadingCategories(false);
  };

  const fetchProducts = useCallback(async (cursor?: QueryDocumentSnapshot) => {
    if (!db) {
      setError(firebaseConfigError ?? 'Firebase is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      const filters: QueryConstraint[] = [];

      const orderOptions: QueryConstraint[][] =
        selectedSort === 'price'
          ? [[orderBy('price', 'asc'), orderBy(documentId(), 'asc')], [orderBy(documentId(), 'asc')]]
          : selectedSort === 'featured'
            ? [
                [orderBy('rankingScore', 'desc'), orderBy('featuredRank', 'desc'), orderBy(documentId(), 'asc')],
                [orderBy('featuredRank', 'desc'), orderBy(documentId(), 'asc')],
                [orderBy(documentId(), 'asc')],
              ]
            : [[orderBy('publishedAt', 'desc')], [orderBy(documentId(), 'asc')]];

      let snapshot = null;
      let cursorDoc = cursor;

      for (let index = 0; index < orderOptions.length; index += 1) {
        const ordering = orderOptions[index];
        try {
          const collectedItems: PublicProduct[] = [];
          let scanCursor = cursor;
          let latestSnapshotDoc: QueryDocumentSnapshot | undefined;
          let lastSnapshotSize = 0;

          for (let scanIndex = 0; scanIndex < FETCH_SCAN_BATCHES; scanIndex += 1) {
            const baseQuery = query(collection(db, 'publicProducts'), ...filters, ...ordering, limit(PAGE_SIZE));
            const pagedQuery = scanCursor ? query(baseQuery, startAfter(scanCursor)) : baseQuery;
            const scanSnapshot = await getDocs(pagedQuery);
            lastSnapshotSize = scanSnapshot.docs.length;

            if (scanSnapshot.empty) {
              break;
            }

            const batchItemsRaw = scanSnapshot.docs
              .map((doc) => ({ id: doc.id, ...doc.data() }) as PublicProduct)
              .filter((item) => isPublicListing(item) && hasDisplayImage(item));

            const batchItems = await hydrateVerifiedFromStores(batchItemsRaw);

            collectedItems.push(...batchItems.filter((item) => isVerifiedStore(item.verified)));
            latestSnapshotDoc = scanSnapshot.docs.at(-1) ?? latestSnapshotDoc;
            scanCursor = latestSnapshotDoc;

            if (lastSnapshotSize < PAGE_SIZE || collectedItems.length >= PAGE_SIZE) {
              break;
            }
          }

          const shouldTryFallbackForMissingPublishedAt =
            selectedSort === 'newest' &&
            !cursor &&
            index === 0 &&
            collectedItems.length === 0 &&
            orderOptions.length > 1;

          if (shouldTryFallbackForMissingPublishedAt) {
            continue;
          }

          if (selectedSort === 'newest' && !cursor && index === 0 && collectedItems.length < PAGE_SIZE) {
            const seenIds = new Set(collectedItems.map((item) => item.id));
            let fallbackCursor: QueryDocumentSnapshot | undefined;
            let safetyCounter = 0;

            while (collectedItems.length < PAGE_SIZE && safetyCounter < FETCH_SCAN_BATCHES) {
              safetyCounter += 1;
              const fallbackBaseQuery = query(collection(db, 'publicProducts'), ...filters, orderBy(documentId(), 'asc'), limit(PAGE_SIZE));
              const fallbackPagedQuery = fallbackCursor ? query(fallbackBaseQuery, startAfter(fallbackCursor)) : fallbackBaseQuery;
              const fallbackSnapshot = await getDocs(fallbackPagedQuery);

              if (fallbackSnapshot.empty) {
                break;
              }

              fallbackCursor = fallbackSnapshot.docs.at(-1) ?? fallbackCursor;

              const fallbackBatchRaw = fallbackSnapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }) as PublicProduct)
                .filter((item) => !seenIds.has(item.id) && isPublicListing(item) && hasDisplayImage(item));

              if (fallbackBatchRaw.length === 0) {
                if (fallbackSnapshot.docs.length < PAGE_SIZE) break;
                continue;
              }

              const fallbackBatch = await hydrateVerifiedFromStores(fallbackBatchRaw);
              const fallbackVisible = fallbackBatch.filter((item) => isVerifiedStore(item.verified));

              fallbackVisible.forEach((item) => {
                if (!seenIds.has(item.id)) {
                  seenIds.add(item.id);
                  collectedItems.push(item);
                }
              });

              if (fallbackSnapshot.docs.length < PAGE_SIZE) {
                break;
              }
            }
          }

          snapshot = {
            docs: selectStoreBalancedProducts(collectedItems, PAGE_SIZE).map((item) => ({
              id: item.id,
              data: () => item,
            })),
            lastDoc: latestSnapshotDoc,
            isEndReached: lastSnapshotSize < PAGE_SIZE,
          };
          cursorDoc = snapshot.lastDoc;
          break;
        } catch (queryErr) {
          const firestoreError = queryErr as FirestoreError;
          if (firestoreError?.code !== 'failed-precondition') {
            throw queryErr;
          }
        }
      }

      if (!snapshot) {
        throw new Error('Unable to fetch products with the available indexes.');
      }

      const nextItems = snapshot.docs
        .map((doc) => doc.data() as PublicProduct)
        .filter((item) => isPublicListing(item) && hasDisplayImage(item) && isVerifiedStore(item.verified));

      setProducts((current) => (cursor ? [...current, ...nextItems] : nextItems));
      setCities((current) => {
        const next = new Set(current);
        nextItems.forEach((item) => next.add(getStoreCity(item)));
        return Array.from(next).sort((a, b) => a.localeCompare(b));
      });
      setLastDoc(snapshot.isEndReached ? null : (cursorDoc ?? null));
    } catch (err) {
      console.error('Failed to fetch products', err);
      const firestoreError = err as FirestoreError;
      const debugDetails = {
        operation: 'fetchProducts',
        selectedCategory,
        selectedSort,
        firestoreCode: firestoreError?.code ?? 'unknown',
        firestoreMessage: firestoreError?.message ?? 'No message provided',
        firebaseConfigError: firebaseConfigError ?? null,
      };
      setDebugInfo(JSON.stringify(debugDetails, null, 2));

      if (firestoreError?.code === 'permission-denied') {
        setError('Could not load products due to Firestore rules. Allow public read access to publicProducts.');
      } else if (firestoreError?.code === 'failed-precondition') {
        setError(
          'Could not load products. Deploy Firestore indexes and rules with `firebase deploy --only firestore:indexes,firestore:rules`.',
        );
      } else {
        setError('Could not load products. Check debug details below to see the exact Firestore error.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [hydrateVerifiedFromStores, itemTypeFilter, selectedCategory, selectedSort]);

  const fetchProductsForSearch = useCallback(async () => {
    if (!db) {
      setError(firebaseConfigError ?? 'Firebase is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      const filters: QueryConstraint[] = [];

      const allItems: PublicProduct[] = [];
      let cursor: QueryDocumentSnapshot | undefined;

      while (allItems.length < SEARCH_SCAN_LIMIT) {
        const batchQuery = query(
          collection(db, 'publicProducts'),
          ...filters,
          orderBy(documentId(), 'asc'),
          limit(SEARCH_BATCH_SIZE),
          ...(cursor ? [startAfter(cursor)] : []),
        );

        const snapshot = await getDocs(batchQuery);
        const batchItemsRaw = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as PublicProduct)
          .filter((item) => isPublicListing(item) && hasDisplayImage(item));

        const batchItems = (await hydrateVerifiedFromStores(batchItemsRaw)).filter((item) => isVerifiedStore(item.verified));

        allItems.push(...batchItems);

        if (snapshot.docs.length < SEARCH_BATCH_SIZE) {
          break;
        }

        cursor = snapshot.docs.at(-1);
      }

      setProducts(allItems.slice(0, SEARCH_SCAN_LIMIT));
      setLastDoc(null);
      setCities((current) => {
        const next = new Set(current);
        allItems.forEach((item) => next.add(getStoreCity(item)));
        return Array.from(next).sort((a, b) => a.localeCompare(b));
      });
    } catch (err) {
      console.error('Failed to fetch products for search', err);
      setError('Could not load all products for search. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [hydrateVerifiedFromStores, itemTypeFilter]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setProducts([]);
    setLastDoc(null);
    if (searchText.trim().length > 0) return;
    fetchProducts();
  }, [fetchProducts, searchText]);

  useEffect(() => {
    if (searchText.trim().length === 0) return;
    setProducts([]);
    setLastDoc(null);
    fetchProductsForSearch();
  }, [fetchProductsForSearch, searchText]);

  return (
    <section className="marketplace">
      <div className="toolbar">
        <div className="searchWrap">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search products, services, stores, or categories"
          />
        </div>

        <div className="sortWrap">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={selectedSort} onChange={(event) => setSelectedSort(event.target.value as SortOption)}>
            <option value="featured">Popular</option>
            <option value="newest">Newest</option>
            <option value="price">Cheapest</option>
          </select>
        </div>
      </div>
      <div className="toolbar">
        <div className="sortWrap">
          <label htmlFor="city-filter">City</label>
          <select id="city-filter" value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)}>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city === 'all' ? 'All cities' : city}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="categories" role="tablist" aria-label="Product categories">
        {categories.map((category) => {
          const active = category === selectedCategory;
          return (
            <button
              type="button"
              key={category}
              role="tab"
              aria-selected={active}
              className={`chip ${active ? 'active' : ''}`}
              disabled={isLoadingCategories}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          );
        })}
      </div>

      {error && <p className="error">{error}</p>}
      {debugInfo && (
        <details className="error" open>
          <summary>Debug details</summary>
          <pre>{debugInfo}</pre>
        </details>
      )}

      <div className="grid">
        {isLoading && products.length === 0
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
              const shouldCollapseDescription = (item.description?.trim().length ?? 0) > 260;
              const isExpanded = expandedDescriptionIds.has(item.id);
              const descriptionClassName = `formattedDescription compact ${shouldCollapseDescription && !isExpanded ? 'isCollapsed' : ''}`.trim();

              return (
                <article key={item.id} className="card">
                  <div className="imageWrap">
                    <Image
                      src={item.imageUrls?.[0] ?? 'https://placehold.co/640x640'}
                      alt={item.imageAlt?.trim() || getProductName(item) || 'Product image'}
                      loading="lazy"
                      width={360}
                      height={360}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      style={{ width: '100%', height: 'auto' }}
                    />
                  </div>
                  <h3>{getProductName(item)}</h3>
                  <Link href={getProductHref(item.id, item.productName)}>View product details</Link>
                  <FormattedDescription text={item.description ?? ''} className={descriptionClassName} />
                  {shouldCollapseDescription && (
                    <button type="button" className="descriptionToggle" onClick={() => toggleDescription(item.id)}>
                      {isExpanded ? 'View less' : 'View more'}
                    </button>
                  )}
                  <div className="meta">
                    <span className="storeIdentity">
                      {storeHref ? (
                        <Link href={storeHref}>{item.storeName ?? 'Unknown store'}</Link>
                      ) : (
                        item.storeName ?? 'Unknown store'
                      )}
                      {isVerifiedStore(item.verified) ? (
                        <span className="verifiedBadge" aria-label="Verified store">
                          Verified
                        </span>
                      ) : null}
                    </span>
                    <strong>{formatPrice(item.price, item.currency)}</strong>
                  </div>
                  <p>City: {getStoreCity(item)}</p>
                  <p>Phone: {getStorePhone(item)}</p>
                  <WhatsAppChatButton
                    phone={getContactPhone(item)}
                    message={buildWhatsAppMessage(item)}
                    label="Chat now on WhatsApp"
                    fallbackLabel="WhatsApp unavailable"
                  />
                </article>
              );
            })}
      </div>

      {!isLoading && visibleProducts.length === 0 && !error && (
        <div className="emptyState">
          <h3>No items found</h3>
          <p>Try a different search term, category, or sort option.</p>
        </div>
      )}

      <div className="actions">
        <button
          type="button"
          disabled={!lastDoc || isLoading || searchText.trim().length > 0}
          onClick={() => fetchProducts(lastDoc ?? undefined)}
        >
          {isLoading && products.length > 0 ? 'Loading more...' : 'Load more products'}
        </button>
      </div>
    </section>
  );
}
