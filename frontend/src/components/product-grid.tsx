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

type PublicProduct = {
  id: string;
  storeId?: string;
  productName?: string;
  description?: string;
  categoryKey?: string;
  imageUrls?: string[];
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

  const visibleProducts = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    return products.filter((product) => {
      if (!text) return true;
      const haystack = [product.productName, product.description, product.storeName, product.categoryKey]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(text);
    });
  }, [products, searchText]);

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
          const category = docItem.data().categoryKey;
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

      const nextItems = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as PublicProduct[];

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

              return (
                <article key={item.id} className="card">
                  <div className="imageWrap">
                    <Image
                      src={item.imageUrls?.[0] ?? 'https://placehold.co/640x640'}
                      alt={item.productName ?? 'Product image'}
                      loading="lazy"
                      width={360}
                      height={360}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      style={{ width: '100%', height: 'auto' }}
                    />
                  </div>
                  <h3>
                    <Link href={`/products/${item.id}`}>{item.productName ?? 'Untitled item'}</Link>
                  </h3>
                  <p>{item.description ?? ''}</p>
                  <div className="meta">
                    <span>
                      {item.storeId ? (
                        <Link href={`/stores/${encodeURIComponent(item.storeId)}`}>{item.storeName ?? 'Unknown store'}</Link>
                      ) : (
                        item.storeName ?? 'Unknown store'
                      )}
                    </span>
                    <strong>{formatPrice(item.price, item.currency)}</strong>
                  </div>
                  <p>City: {getStoreCity(item)}</p>
                  <p>Phone: {getStorePhone(item)}</p>
                  {canContactOnWhatsApp ? (
                    <a className="waButton" href={whatsappLink} target="_blank" rel="noreferrer">
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
