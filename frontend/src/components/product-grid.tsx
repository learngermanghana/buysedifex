'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FirestoreError,
  QueryConstraint,
  QueryDocumentSnapshot,
  collection,
  doc,
  getDoc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db, firebaseConfigError } from '@/lib/firebase';
import { getStoreHref } from '@/lib/store-route';
import { getProductHref } from '@/lib/product-route';
import { resolveClosestCategoryKey } from '@/lib/category-taxonomy';
import './product-grid.css';

const PRIMARY_COLLECTION = 'publicListings';
const LEGACY_COLLECTIONS = ['publicProducts', 'publicServices'] as const;

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
  originalPrice?: number;
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
  listingType?: string;
  salesMode?: string;
  isVisible?: boolean | string | number;
  verified?: boolean | string | number;
  featuredRank?: number;
  rankingScore?: number;
  publishedAt?: { seconds: number };
  isPublished?: boolean | string | number;
};

type SortOption = 'newest' | 'price' | 'featured';
type ItemTypeFilter = 'all' | 'product' | 'service' | 'course';

const PAGE_SIZE = 24;
const QUERY_LIMIT = 100;
const FETCH_SCAN_BATCHES = 4;
const FILTERED_FETCH_SCAN_BATCHES = 12;
const SEARCH_SCAN_LIMIT = 300;
const SEARCH_BATCH_SIZE = 100;

const getMarketplaceCollections = async (): Promise<string[]> => {
  if (!db) return [PRIMARY_COLLECTION];
  const primarySnapshot = await getDocs(query(collection(db, PRIMARY_COLLECTION), limit(1)));
  if (!primarySnapshot.empty) return [PRIMARY_COLLECTION];
  return [...LEGACY_COLLECTIONS];
};

const SEARCH_HISTORY_KEY = 'sedifex-recent-searches';
const MAX_HISTORY_ITEMS = 6;
const MAX_SUGGESTIONS = 8;

const SYNONYM_GROUPS = [
  ['sneakers', 'trainers', 'running shoes', 'kicks'],
  ['tee', 'tshirt', 't-shirt', 'shirt'],
  ['trouser', 'trousers', 'pants'],
  ['phone', 'mobile', 'smartphone'],
  ['laptop', 'notebook'],
  ['fridge', 'refrigerator'],
  ['tv', 'television'],
  ['beauty', 'cosmetics', 'makeup'],
];

const levenshteinDistance = (left: string, right: string) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const dp = Array.from({ length: left.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= right.length; j += 1) dp[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }

  return dp[left.length][right.length];
};



const asStoreVerified = (value: unknown) => {
  if (value === true) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  if (typeof value === 'number') return value === 1;
  return false;
};

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

const getProductName = (item: PublicProduct) => (item.productName ?? item.name)?.trim() || 'Untitled item';
const getCategory = (item: PublicProduct) =>
  resolveClosestCategoryKey({
    category: item.categoryKey?.trim() || item.category?.trim(),
    productName: getProductName(item),
    description: item.description,
    itemType: item.itemType,
  });


const getStoreCity = (item: PublicProduct) => {
  const rawCity = item.city ?? item.storeCity;
  return rawCity?.trim() || 'City unavailable';
};

const asTruthyBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
};

const getDisplayImages = (item: PublicProduct): string[] => {
  const decodeImageValues = (value: unknown): string[] => {
    if (typeof value !== 'string') return [];
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim());
        }
      } catch {
        return [trimmed];
      }
    }

    return [trimmed];
  };

  const normalizeStorageUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed.toLowerCase().startsWith('gs://')) return trimmed;

    const withoutPrefix = trimmed.slice(5);
    const slashIndex = withoutPrefix.indexOf('/');
    if (slashIndex === -1) return '';
    const bucket = withoutPrefix.slice(0, slashIndex);
    const objectPath = withoutPrefix.slice(slashIndex + 1);
    if (!bucket || !objectPath) return '';
    return `https://storage.googleapis.com/${bucket}/${objectPath}`;
  };

  const normalizeImageCandidate = (value: string): string =>
    normalizeStorageUrl(value)
      .trim()
      .replace(/^['"]+|['"]+$/g, '')
      .replace(/\\u002F/gi, '/')
      .replace(/\\\//g, '/');

  const isDisplayableImageUrl = (value: string) => {
    const candidate = normalizeImageCandidate(value);
    if (!candidate) return false;

    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const imageListRaw = Array.isArray(item.imageUrls)
    ? item.imageUrls
    : typeof item.imageUrls === 'string'
      ? [item.imageUrls]
      : [];
  const imageList = imageListRaw.flatMap((value) => decodeImageValues(value));
  const serviceImageListRaw = Array.isArray(item.serviceImageUrls)
    ? item.serviceImageUrls
    : typeof item.serviceImageUrls === 'string'
      ? [item.serviceImageUrls]
      : [];
  const serviceImageList = serviceImageListRaw.flatMap((value) => decodeImageValues(value));
  const genericImageListRaw = Array.isArray(item.images)
    ? item.images
    : typeof item.images === 'string'
      ? [item.images]
      : [];
  const genericImageList = genericImageListRaw.flatMap((value) => decodeImageValues(value));

  const fallbackImages = [
    item.imageUrl,
    item.image,
    item.serviceImageUrl,
    item.serviceImage,
    item.thumbnailUrl,
    item.photoUrl,
    ...genericImageList,
  ]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  const merged = [...imageList, ...serviceImageList, ...fallbackImages]
    .map((value) => normalizeImageCandidate(value))
    .filter((value) => isDisplayableImageUrl(value));
  return Array.from(new Set(merged));
};

const hasDisplayImage = (item: PublicProduct) => getDisplayImages(item).length > 0;
const isPublicListing = (item: PublicProduct) => asTruthyBoolean(item.isVisible) || asTruthyBoolean(item.isPublished);

const isVerifiedStore = (value: PublicProduct['verified']) => {
  if (value == null) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
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

const capProductsPerStore = (items: PublicProduct[], limitPerStore: number) => {
  if (limitPerStore <= 0) return items;
  const counts = new Map<string, number>();
  const filtered: PublicProduct[] = [];

  items.forEach((item) => {
    const storeKey = item.storeId?.trim() || item.storeName?.trim() || `unknown-store-${item.id}`;
    const currentCount = counts.get(storeKey) ?? 0;
    if (currentCount >= limitPerStore) return;
    counts.set(storeKey, currentCount + 1);
    filtered.push(item);
  });

  return filtered;
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

const resolveListingType = (item: Pick<PublicProduct, 'listingType' | 'itemType'>): Exclude<ItemTypeFilter, 'all'> => {
  const listingType = item.listingType?.trim().toLowerCase();
  if (listingType === 'service' || listingType === 'course' || listingType === 'product') return listingType;
  const fallbackItemType = item.itemType?.trim().toLowerCase();
  if (fallbackItemType === 'service') return 'service';
  if (fallbackItemType === 'course') return 'course';
  return 'product';
};

const resolveCtaLabel = (item: Pick<PublicProduct, 'listingType' | 'itemType' | 'salesMode'>) => {
  const listingType = resolveListingType(item);
  const salesMode = item.salesMode?.trim().toLowerCase();
  if (salesMode === 'request_quote') return 'Request quote';
  if (listingType === 'product' && salesMode === 'buy_now') return 'Buy now';
  if (listingType === 'service' && salesMode === 'book_now') return 'Book now';
  if (listingType === 'course' && salesMode === 'register') return 'Register';
  return 'View details';
};

const matchesItemTypeFilter = (item: Pick<PublicProduct, 'listingType' | 'itemType'>, filter: ItemTypeFilter) => {
  if (filter === 'all') return true;
  return resolveListingType(item) === filter;
};

export function ProductGrid({ itemTypeFilter = 'all' }: ProductGridProps) {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [cities, setCities] = useState<string[]>(['all']);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<SortOption>('newest');
  const [searchText, setSearchText] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const storeVerifiedCacheRef = useRef<Map<string, boolean>>(new Map());

  const filterByVerifiedStore = useCallback(async (items: PublicProduct[]) => {
    if (items.length === 0) return items;
    if (db == null) return items;
    const firestore: NonNullable<typeof db> = db;

    const uniqueStoreIds = Array.from(
      new Set(items.map((item) => item.storeId?.trim()).filter((value): value is string => Boolean(value))),
    );

    const unresolvedStoreIds = uniqueStoreIds.filter((storeId) => !storeVerifiedCacheRef.current.has(storeId));

    await Promise.all(
      unresolvedStoreIds.map(async (storeId) => {
        try {
          const snapshot = await getDoc(doc(firestore, 'stores', storeId));
          const verified = snapshot.exists() ? asStoreVerified((snapshot.data() as Record<string, unknown>).verified) : false;
          storeVerifiedCacheRef.current.set(storeId, verified);
        } catch {
          storeVerifiedCacheRef.current.set(storeId, false);
        }
      }),
    );

    return items.filter((item) => {
      const storeId = item.storeId?.trim();
      if (!storeId) return false;
      return storeVerifiedCacheRef.current.get(storeId) === true;
    });
  }, []);

  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const hasServerSideItemTypeFilter = itemTypeFilter !== 'all';

  const buildServerFilters = useCallback((): QueryConstraint[] => {
    const filters: QueryConstraint[] = [];
    if (hasServerSideItemTypeFilter) {
      filters.push(where('listingType', '==', itemTypeFilter));
    }
    return filters;
  }, [hasServerSideItemTypeFilter, itemTypeFilter]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      setRecentSearches(parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_HISTORY_ITEMS));
    } catch {
      // ignore malformed local storage
    }
  }, []);

  const searchableTerms = useMemo(() => {
    const terms = new Set<string>();
    products.forEach((product) => {
      [getProductName(product), product.storeName, getCategory(product), product.description, resolveListingType(product)].forEach((term) => {
        const normalized = term?.trim().toLowerCase();
        if (normalized) terms.add(normalized);
      });
    });
    return Array.from(terms);
  }, [products]);

  const normalizedSearchText = searchText.trim().toLowerCase();

  const expandedSearchTerms = useMemo(() => {
    if (!normalizedSearchText) return [] as string[];
    const expanded = new Set<string>([normalizedSearchText]);

    SYNONYM_GROUPS.forEach((group) => {
      if (group.some((entry) => entry.includes(normalizedSearchText) || normalizedSearchText.includes(entry))) {
        group.forEach((entry) => expanded.add(entry));
      }
    });

    searchableTerms.forEach((term) => {
      const distance = levenshteinDistance(normalizedSearchText, term);
      const threshold = Math.max(1, Math.floor(normalizedSearchText.length * 0.3));
      if (distance <= threshold) expanded.add(term);
    });

    return Array.from(expanded);
  }, [normalizedSearchText, searchableTerms]);

  const suggestions = useMemo(() => {
    if (!normalizedSearchText) return recentSearches;

    const synonymSuggestions = new Set<string>();
    SYNONYM_GROUPS.forEach((group) => {
      if (group.some((entry) => entry.includes(normalizedSearchText) || normalizedSearchText.includes(entry))) {
        group.forEach((entry) => synonymSuggestions.add(entry));
      }
    });

    const ranked = searchableTerms
      .filter((term) => term.includes(normalizedSearchText) || levenshteinDistance(normalizedSearchText, term) <= 2)
      .sort((a, b) => levenshteinDistance(normalizedSearchText, a) - levenshteinDistance(normalizedSearchText, b));

    return Array.from(new Set([...ranked, ...synonymSuggestions])).slice(0, MAX_SUGGESTIONS);
  }, [normalizedSearchText, recentSearches, searchableTerms]);

  const commitSearch = useCallback((value: string) => {
    const normalized = value.trim();
    setSearchText(normalized);
    if (!normalized) return;

    setRecentSearches((current) => {
      const next = [normalized, ...current.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(
        0,
        MAX_HISTORY_ITEMS,
      );
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const visibleProducts = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    const normalizedProducts = normalizeStoreNamesByStoreId(products);
    const matchingProducts = normalizedProducts.filter((product) => {
      const typeMatches = matchesItemTypeFilter(product, itemTypeFilter);
      if (!typeMatches) return false;
      const cityMatches = selectedCity === 'all' || getStoreCity(product).toLowerCase() === selectedCity.toLowerCase();
      if (!cityMatches) return false;
      if (!text) return true;
      const haystack = [
        getProductName(product),
        product.description,
        product.storeName,
        getCategory(product),
        product.sku,
        product.batchNumber,
        resolveListingType(product),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return expandedSearchTerms.some((term) => haystack.includes(term));
    });

    const imageReadyProducts = matchingProducts.filter((product) => isPublicListing(product) && hasDisplayImage(product));
    const sortedProducts = sortProducts(imageReadyProducts, selectedSort);
    return mixProductsByCategoryThenStore(sortedProducts);
  }, [expandedSearchTerms, itemTypeFilter, products, searchText, selectedCity, selectedSort]);


  const fetchProducts = useCallback(async (cursor?: QueryDocumentSnapshot) => {
    if (!db) {
      setError(firebaseConfigError ?? 'Firebase is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      const collectionsToQuery = await getMarketplaceCollections();
      const filters = buildServerFilters();

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

      for (const collectionName of collectionsToQuery) {
        for (let index = 0; index < orderOptions.length; index += 1) {
        const ordering = orderOptions[index];
        try {
          const collectedItems: PublicProduct[] = [];
          let scanCursor = cursor;
          let latestSnapshotDoc: QueryDocumentSnapshot | undefined;
          let lastSnapshotSize = 0;

          const maxScanBatches = hasServerSideItemTypeFilter ? FILTERED_FETCH_SCAN_BATCHES : FETCH_SCAN_BATCHES;

          for (let scanIndex = 0; scanIndex < maxScanBatches; scanIndex += 1) {
            const baseQuery = query(collection(db, collectionName), ...filters, ...ordering, limit(QUERY_LIMIT));
            const pagedQuery = scanCursor ? query(baseQuery, startAfter(scanCursor)) : baseQuery;
            const scanSnapshot = await getDocs(pagedQuery);
            lastSnapshotSize = scanSnapshot.docs.length;

            if (scanSnapshot.empty) {
              break;
            }

            const batchItemsRaw = scanSnapshot.docs
              .map((doc) => ({ id: doc.id, ...doc.data() }) as PublicProduct)
              .filter(
                (item) =>
                  matchesItemTypeFilter(item, itemTypeFilter) && isPublicListing(item) && hasDisplayImage(item),
              );

            const batchItems = await filterByVerifiedStore(batchItemsRaw);
            collectedItems.push(...batchItems);
            latestSnapshotDoc = scanSnapshot.docs.at(-1) ?? latestSnapshotDoc;
            scanCursor = latestSnapshotDoc;

            if (lastSnapshotSize < QUERY_LIMIT || collectedItems.length >= QUERY_LIMIT) {
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

            const fallbackScanLimit = hasServerSideItemTypeFilter ? FILTERED_FETCH_SCAN_BATCHES : FETCH_SCAN_BATCHES;

            while (collectedItems.length < PAGE_SIZE && safetyCounter < fallbackScanLimit) {
              safetyCounter += 1;
              const fallbackBaseQuery = query(collection(db, collectionName), ...filters, orderBy(documentId(), 'asc'), limit(PAGE_SIZE));
              const fallbackPagedQuery = fallbackCursor ? query(fallbackBaseQuery, startAfter(fallbackCursor)) : fallbackBaseQuery;
              const fallbackSnapshot = await getDocs(fallbackPagedQuery);

              if (fallbackSnapshot.empty) {
                break;
              }

              fallbackCursor = fallbackSnapshot.docs.at(-1) ?? fallbackCursor;

              const fallbackBatchRaw = fallbackSnapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }) as PublicProduct)
                .filter(
                  (item) =>
                    !seenIds.has(item.id) &&
                    matchesItemTypeFilter(item, itemTypeFilter) &&
                    isPublicListing(item) &&
                    hasDisplayImage(item),
                );

              if (fallbackBatchRaw.length === 0) {
                if (fallbackSnapshot.docs.length < PAGE_SIZE) break;
                continue;
              }

              const fallbackBatch = await filterByVerifiedStore(fallbackBatchRaw);
              fallbackBatch.forEach((item) => {
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
            docs: collectedItems.slice(0, QUERY_LIMIT).map((item) => ({
              id: item.id,
              data: () => item,
            })),
            lastDoc: latestSnapshotDoc,
            isEndReached: lastSnapshotSize < QUERY_LIMIT,
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

        if (snapshot) break;
      }

      if (!snapshot) {
        throw new Error('Unable to fetch products with the available indexes.');
      }

      const nextItemsRaw = snapshot.docs
        .map((doc) => doc.data() as PublicProduct)
        .filter((item) => isPublicListing(item) && hasDisplayImage(item));
      const nextItems = capProductsPerStore(mixProductsAcrossStores(nextItemsRaw), 2);

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
        selectedSort,
        firestoreCode: firestoreError?.code ?? 'unknown',
        firestoreMessage: firestoreError?.message ?? 'No message provided',
        firebaseConfigError: firebaseConfigError ?? null,
      };
      setDebugInfo(JSON.stringify(debugDetails, null, 2));

      if (firestoreError?.code === 'permission-denied') {
        setError('Could not load products due to Firestore rules. Allow public read access to marketplace collections.');
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
  }, [buildServerFilters, filterByVerifiedStore, hasServerSideItemTypeFilter, itemTypeFilter, selectedSort]);

  const fetchProductsForSearch = useCallback(async () => {
    if (!db) {
      setError(firebaseConfigError ?? 'Firebase is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      const collectionsToQuery = await getMarketplaceCollections();
      const filters = buildServerFilters();

      const allItems: PublicProduct[] = [];

      for (const collectionName of collectionsToQuery) {
      let cursor: QueryDocumentSnapshot | undefined;

      while (allItems.length < SEARCH_SCAN_LIMIT) {
        const batchQuery = query(
          collection(db, collectionName),
          ...filters,
          orderBy(documentId(), 'asc'),
          limit(SEARCH_BATCH_SIZE),
          ...(cursor ? [startAfter(cursor)] : []),
        );

        const snapshot = await getDocs(batchQuery);
        const batchItemsRaw = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as PublicProduct)
          .filter(
            (item) => matchesItemTypeFilter(item, itemTypeFilter) && isPublicListing(item) && hasDisplayImage(item),
          );

        const batchItems = await filterByVerifiedStore(batchItemsRaw);
        allItems.push(...batchItems);

        if (snapshot.docs.length < SEARCH_BATCH_SIZE) {
          break;
        }

        cursor = snapshot.docs.at(-1);
      }
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
  }, [buildServerFilters, filterByVerifiedStore, itemTypeFilter]);

  useEffect(() => {
    setProducts([]);
    setLastDoc(null);
    setVisibleCount(PAGE_SIZE);
    if (searchText.trim().length > 0) return;
    fetchProducts();
  }, [fetchProducts, searchText]);

  useEffect(() => {
    if (searchText.trim().length === 0) return;
    setProducts([]);
    setLastDoc(null);
    setVisibleCount(PAGE_SIZE);
    fetchProductsForSearch();
  }, [fetchProductsForSearch, searchText]);

  return (
    <section className="marketplace">
      <div className="marketplaceHeader">
        <h1>{itemTypeFilter === 'service' ? 'Services' : itemTypeFilter === 'course' ? 'Courses' : 'Products'}</h1>
        <p>Discover verified marketplace listings from Sedifex stores.</p>
      </div>
      <div className="toolbar">
        <div className="searchWrap">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="search"
            value={searchText}
            onChange={(event) => { setSearchText(event.target.value); setIsSuggestionOpen(true); }}
            onFocus={() => setIsSuggestionOpen(true)}
            placeholder="Search by name, description, store, category, or listing type"
            onKeyDown={(event) => { if (event.key === 'Enter') { commitSearch(searchText); setIsSuggestionOpen(false); } }}
          />
          {isSuggestionOpen && suggestions.length > 0 && (
            <ul className="searchSuggestions" role="listbox" aria-label="Search suggestions">
              {suggestions.map((suggestion) => (
                <li key={suggestion}>
                  <button
                    type="button"
                    onMouseDown={() => {
                      commitSearch(suggestion);
                      setIsSuggestionOpen(false);
                    }}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          )}
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
          : visibleProducts.slice(0, visibleCount).map((item) => {
              const storeHref = getStoreHref(item.storeId, item.storeName);
              const shortDescription = (item.description ?? '')
                .split(/\n+/)
                .map((line) => line.trim())
                .filter(Boolean)[0] ?? '';

              return (
                <article key={item.id} className="card">
                  <Link href={getProductHref(item.id, item.productName)} className="imageWrap">
                    <Image
                      src={getDisplayImages(item)[0] ?? 'https://placehold.co/640x640'}
                      alt={item.imageAlt?.trim() || getProductName(item) || 'Product image'}
                      loading="lazy"
                      unoptimized
                      width={360}
                      height={360}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </Link>
                  <h3><Link href={getProductHref(item.id, item.productName)}>{getProductName(item)}</Link></h3>
                  <p className="productShortDescription">{shortDescription}</p>
                  <div className="meta">
                    <span className="verifiedBadge" aria-label={`Listing type ${resolveListingType(item)}`}>{resolveListingType(item)}</span>
                    <span className="storeIdentity">
                      {storeHref ? (
                        <Link href={storeHref}>{item.storeName ?? 'Unknown store'}</Link>
                      ) : (
                        item.storeName ?? 'Unknown store'
                      )}
                      {isVerifiedStore(item.verified) ? (
                        <span className="verifiedBadge" aria-label="Verified by Sedifex">
                          <span className="verifiedPulse" aria-hidden="true" />
                          Verified by Sedifex
                        </span>
                      ) : null}
                    </span>
                    <span>{getCategory(item)}</span>
                    <strong className="price">{formatPrice(item.price, item.currency)}</strong>
                  </div>
                  {isVerifiedStore(item.verified) ? <p className="trustScoreCard">🛡 Sedifex Trust+ 98%</p> : null}
                  {typeof item.originalPrice === 'number' && typeof item.price === 'number' && item.price < item.originalPrice ? (
                    <p className="trustScoreCard">Sedifex online deal · Order through Sedifex to get this price.</p>
                  ) : null}
                  <div className="cardActions">
                    <Link href={getProductHref(item.id, item.productName)} className="buyNowButton" aria-label={`${resolveCtaLabel(item)} ${getProductName(item)}`}>
                      {resolveCtaLabel(item)}
                    </Link>
                  </div>
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
        {visibleCount < visibleProducts.length ? (
          <button type="button" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>Load more</button>
        ) : (
          <button
            type="button"
            disabled={!lastDoc || isLoading || searchText.trim().length > 0}
            onClick={() => fetchProducts(lastDoc ?? undefined)}
          >
            {isLoading && products.length > 0 ? 'Loading more...' : 'Load more products'}
          </button>
        )}
      </div>
    </section>
  );
}
