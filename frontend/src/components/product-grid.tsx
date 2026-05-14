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
import { FormattedDescription } from '@/components/formatted-description';
import { getStoreHref } from '@/lib/store-route';
import { getProductHref } from '@/lib/product-route';
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
  isVisible?: boolean | string | number;
  verified?: boolean | string | number;
  featuredRank?: number;
  rankingScore?: number;
  publishedAt?: { seconds: number };
  isPublished?: boolean | string | number;
};

type SortOption = 'newest' | 'price' | 'featured';
type ItemTypeFilter = 'all' | 'product' | 'service';

const PAGE_SIZE = 12;
const FETCH_SCAN_BATCHES = 4;
const FILTERED_FETCH_SCAN_BATCHES = 12;
const SEARCH_SCAN_LIMIT = 300;
const SEARCH_BATCH_SIZE = 100;

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

const getWhatsAppHref = (item: PublicProduct) => {
  const contactPhone = getContactPhone(item);
  if (!contactPhone) return '';

  const normalizedPhone = contactPhone.replace(/[^\d]/g, '');
  if (!normalizedPhone) return '';

  const encodedMessage = encodeURIComponent(buildWhatsAppMessage(item));
  return `https://wa.me/${normalizedPhone}?text=${encodedMessage}`;
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

const matchesItemTypeFilter = (itemType: string | undefined, filter: ItemTypeFilter) => {
  if (filter === 'all') return true;
  const normalized = itemType?.trim().toLowerCase();
  const isService = normalized === 'service' || normalized === 'services' || Boolean(normalized?.includes('service'));
  if (filter === 'service') return isService;
  return !isService;
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
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set());
  const hasServerSideItemTypeFilter = itemTypeFilter !== 'all';

  const buildServerFilters = useCallback((): QueryConstraint[] => {
    const filters: QueryConstraint[] = [];
    if (hasServerSideItemTypeFilter) {
      filters.push(where('itemType', '==', itemTypeFilter));
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
      [getProductName(product), product.storeName, getCategory(product)].forEach((term) => {
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
      const typeMatches = matchesItemTypeFilter(product.itemType, itemTypeFilter);
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

  const fetchProducts = useCallback(async (cursor?: QueryDocumentSnapshot) => {
    if (!db) {
      setError(firebaseConfigError ?? 'Firebase is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
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

      for (let index = 0; index < orderOptions.length; index += 1) {
        const ordering = orderOptions[index];
        try {
          const collectedItems: PublicProduct[] = [];
          let scanCursor = cursor;
          let latestSnapshotDoc: QueryDocumentSnapshot | undefined;
          let lastSnapshotSize = 0;

          const maxScanBatches = hasServerSideItemTypeFilter ? FILTERED_FETCH_SCAN_BATCHES : FETCH_SCAN_BATCHES;

          for (let scanIndex = 0; scanIndex < maxScanBatches; scanIndex += 1) {
            const baseQuery = query(collection(db, 'publicProducts'), ...filters, ...ordering, limit(PAGE_SIZE));
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
                  matchesItemTypeFilter(item.itemType, itemTypeFilter) && isPublicListing(item) && hasDisplayImage(item),
              );

            const batchItems = await filterByVerifiedStore(batchItemsRaw);
            collectedItems.push(...batchItems);
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

            const fallbackScanLimit = hasServerSideItemTypeFilter ? FILTERED_FETCH_SCAN_BATCHES : FETCH_SCAN_BATCHES;

            while (collectedItems.length < PAGE_SIZE && safetyCounter < fallbackScanLimit) {
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
                .filter(
                  (item) =>
                    !seenIds.has(item.id) &&
                    matchesItemTypeFilter(item.itemType, itemTypeFilter) &&
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
            docs: collectedItems.slice(0, PAGE_SIZE).map((item) => ({
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
        .filter((item) => isPublicListing(item) && hasDisplayImage(item));

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
      const filters = buildServerFilters();

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
          .filter(
            (item) => matchesItemTypeFilter(item.itemType, itemTypeFilter) && isPublicListing(item) && hasDisplayImage(item),
          );

        const batchItems = await filterByVerifiedStore(batchItemsRaw);
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
  }, [buildServerFilters, filterByVerifiedStore, itemTypeFilter]);

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
            onChange={(event) => { setSearchText(event.target.value); setIsSuggestionOpen(true); }}
            onFocus={() => setIsSuggestionOpen(true)}
            placeholder="Search products, services, stores, or categories"
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
          : visibleProducts.map((item) => {
              const storeHref = getStoreHref(item.storeId, item.storeName);
              const whatsAppHref = getWhatsAppHref(item);
              const shouldCollapseDescription = (item.description?.trim().length ?? 0) > 260;
              const isExpanded = expandedDescriptionIds.has(item.id);
              const descriptionClassName = `formattedDescription compact ${shouldCollapseDescription && !isExpanded ? 'isCollapsed' : ''}`.trim();

              return (
                <article key={item.id} className="card">
                  <div className="imageWrap">
                    <Image
                      src={getDisplayImages(item)[0] ?? 'https://placehold.co/640x640'}
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
                        <span className="verifiedBadge" aria-label="Verified by Sedifex">
                          <span className="verifiedPulse" aria-hidden="true" />
                          Verified by Sedifex
                        </span>
                      ) : null}
                    </span>
                    <strong>{formatPrice(item.price, item.currency)}</strong>
                  </div>
                  <p>City: {getStoreCity(item)}</p>
                  <p>Phone: {getStorePhone(item)}</p>
                  {isVerifiedStore(item.verified) ? <p className="trustScoreCard">Trust score: 98 / 100</p> : null}
                  <div className="cardActions">
                    <Link href={getProductHref(item.id, item.productName)} className="buyNowButton" aria-label={`Buy ${getProductName(item)} now`}>
                      Buy now
                    </Link>
                    {whatsAppHref ? (
                      <a
                        className="contactStoreButton"
                        href={whatsAppHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Contact ${item.storeName ?? 'store'} on WhatsApp`}
                      >
                        Contact store
                      </a>
                    ) : (
                      <span className="contactStoreButton" aria-disabled="true">
                        Contact store unavailable
                      </span>
                    )}
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
