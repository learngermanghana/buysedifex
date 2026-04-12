'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  FirestoreError,
  QueryConstraint,
  QueryDocumentSnapshot,
  collection,
  getDocs,
  limit,
  documentId,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db, firebaseConfigError } from '@/lib/firebase';
import { FormattedDescription } from '@/components/formatted-description';
import { getStoreHref } from '@/lib/store-route';

type PublicProduct = {
  id: string;
  storeId?: string;
  productName?: string;
  description?: string;
  categoryKey?: string;
  imageUrls?: string[];
  imageAlt?: string;
  price?: number;
  currency?: string;
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
  publishedAt?: { seconds: number };
};

type SortOption = 'newest' | 'price' | 'featured';

const PAGE_SIZE = 12;

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

const toWhatsAppPhone = (phone?: string | number) => String(phone ?? '').replace(/[^\d]/g, '');

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

const buildWhatsAppLink = (item: PublicProduct) => {
  const phone = toWhatsAppPhone(getContactPhone(item));
  if (!phone) return '#';

  const productLabel = item.productName?.trim() || 'this item';
  const storeLabel = item.storeName?.trim() || 'your store';
  const message = `Hi! I'm interested in ${productLabel} from ${storeLabel}. (productId=${item.id}, storeId=${item.storeId ?? ''})`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const getStorePhone = (item: PublicProduct) => getContactPhone(item) || 'Phone unavailable';

const getStoreCity = (item: PublicProduct) => {
  const rawCity = item.city ?? item.storeCity;
  return rawCity?.trim() || 'City unavailable';
};

const isValidImageUrl = (value?: string) => {
  const normalized = value?.trim();
  return Boolean(normalized && /^https?:\/\//i.test(normalized));
};

const getDisplayImageUrl = (item: PublicProduct) => {
  if (!Array.isArray(item.imageUrls)) return null;
  return item.imageUrls.find((url) => isValidImageUrl(url))?.trim() ?? null;
};

const hasDisplayImage = (item: PublicProduct) => Boolean(getDisplayImageUrl(item));
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

export function ProductGrid() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<SortOption>('newest');
  const [searchText, setSearchText] = useState<string>('');
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set());

  const visibleProducts = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    const normalizedProducts = normalizeStoreNamesByStoreId(products);
    const matchingProducts = normalizedProducts.filter((product) => {
      if (!text) return true;
      const haystack = [product.productName, product.description, product.storeName, product.categoryKey]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(text);
    });

    const imageReadyProducts = matchingProducts.filter((product) => hasDisplayImage(product) && isVerifiedStore(product.verified));
    return mixProductsAcrossStores(shuffleProducts(imageReadyProducts));
  }, [products, searchText]);

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
    if (!db) {
      setError(firebaseConfigError ?? 'Firebase is not configured.');
      return;
    }

    setIsLoadingCategories(true);

    try {
      const all = new Set<string>();
      let cursor: QueryDocumentSnapshot | undefined;

      while (true) {
        const base = query(
          collection(db, 'publicProducts'),
          where('isVisible', '==', true),
          orderBy('categoryKey', 'asc'),
          limit(200),
        );

        const paged = cursor ? query(base, startAfter(cursor)) : base;
        const snapshot = await getDocs(paged);

        snapshot.docs.forEach((docItem) => {
          const data = docItem.data() as PublicProduct;
          const category = data.categoryKey;
          if (typeof category === 'string' && category.trim().length > 0) {
            all.add(category);
          }
        });

        if (snapshot.docs.length < 200) {
          break;
        }

        cursor = snapshot.docs.at(-1);
      }

      setCategories(['all', ...Array.from(all).sort()]);
    } catch (err) {
      console.error('Failed to fetch categories', err);
      setCategories(['all']);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchProducts = async (cursor?: QueryDocumentSnapshot) => {
    if (!db) {
      setError(firebaseConfigError ?? 'Firebase is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebugInfo(null);

    try {
      const filters: QueryConstraint[] = [where('isVisible', '==', true)];

      if (selectedCategory !== 'all') {
        filters.push(where('categoryKey', '==', selectedCategory));
      }

      const orderOptions: QueryConstraint[][] =
        selectedSort === 'price'
          ? [[orderBy('price', 'asc'), orderBy(documentId(), 'asc')], [orderBy(documentId(), 'asc')]]
          : selectedSort === 'featured'
            ? [[orderBy('featuredRank', 'desc'), orderBy(documentId(), 'asc')], [orderBy(documentId(), 'asc')]]
            : [[orderBy('publishedAt', 'desc')], [orderBy(documentId(), 'asc')]];

      let snapshot = null;

      for (let index = 0; index < orderOptions.length; index += 1) {
        const ordering = orderOptions[index];
        try {
          const baseQuery = query(collection(db, 'publicProducts'), ...filters, ...ordering, limit(PAGE_SIZE));
          const pagedQuery = cursor ? query(baseQuery, startAfter(cursor)) : baseQuery;
          const nextSnapshot = await getDocs(pagedQuery);

          const shouldTryFallbackForMissingPublishedAt =
            selectedSort === 'newest' &&
            !cursor &&
            index === 0 &&
            nextSnapshot.empty &&
            orderOptions.length > 1;

          if (shouldTryFallbackForMissingPublishedAt) {
            continue;
          }

          snapshot = nextSnapshot;
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
        .map((doc) => ({ id: doc.id, ...doc.data() }) as PublicProduct)
        .filter((item) => hasDisplayImage(item) && isVerifiedStore(item.verified));

      setProducts((current) => (cursor ? [...current, ...nextItems] : nextItems));
      setLastDoc(snapshot.docs.at(-1) ?? null);
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
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setProducts([]);
    setLastDoc(null);
    fetchProducts();
  }, [selectedCategory, selectedSort]);

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
            <option value="newest">Newest</option>
            <option value="price">Price</option>
            <option value="featured">Featured</option>
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
              const whatsappLink = buildWhatsAppLink(item);
              const canContactOnWhatsApp = whatsappLink !== '#';
              const storeHref = getStoreHref(item.storeId, item.storeName);
              const shouldCollapseDescription = (item.description?.trim().length ?? 0) > 260;
              const isExpanded = expandedDescriptionIds.has(item.id);
              const descriptionClassName = `formattedDescription compact ${shouldCollapseDescription && !isExpanded ? 'isCollapsed' : ''}`.trim();

              return (
                <article key={item.id} className="card">
                  <div className="imageWrap">
                    <Image
                      src={getDisplayImageUrl(item) ?? 'https://placehold.co/640x640'}
                      alt={item.imageAlt?.trim() || item.productName || 'Product image'}
                      loading="lazy"
                      width={360}
                      height={360}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      style={{ width: '100%', height: 'auto' }}
                    />
                  </div>
                  <h3>{item.productName ?? 'Untitled item'}</h3>
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
                  {canContactOnWhatsApp ? (
                    <a className="waButton" href={whatsappLink} target="_blank" rel="noreferrer" aria-label={`Contact ${item.storeName ?? 'store'} on WhatsApp about ${item.productName ?? 'this item'}`}>
                      Contact on WhatsApp
                    </a>
                  ) : (
                    <span className="waButton" aria-disabled="true" title="WhatsApp contact unavailable">
                      WhatsApp unavailable
                    </span>
                  )}
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
        <button type="button" disabled={!lastDoc || isLoading} onClick={() => fetchProducts(lastDoc ?? undefined)}>
          {isLoading && products.length > 0 ? 'Loading more...' : 'Load more products'}
        </button>
      </div>
    </section>
  );
}
