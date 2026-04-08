'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  FirestoreError,
  QueryConstraint,
  QueryDocumentSnapshot,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { buildCategoryPath, formatCategoryName } from '@/lib/category';
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
  waLink?: string;
  storePhone?: string;
  shopLink?: string;
  itemType?: string;
  isVisible?: boolean;
  featuredRank?: number;
  publishedAt?: { seconds: number };
};

type SortOption = 'newest' | 'price' | 'featured';

const PAGE_SIZE = 12;

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=900&q=80',
];

const getFallbackImage = (category?: string) => {
  const seed = (category ?? 'general').split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return FALLBACK_IMAGES[seed % FALLBACK_IMAGES.length];
};

const formatPrice = (price?: number, currency?: string) => {
  if (price == null) return 'Price unavailable';
  const normalizedCurrency = (currency ?? 'GHS').toUpperCase();
  const currencyLabel = normalizedCurrency === 'GHS' ? 'GH₵' : normalizedCurrency;
  return `${currencyLabel} ${price.toFixed(2)}`;
};

const toWhatsAppPhone = (phone?: string) => (phone ?? '').replace(/[^\d]/g, '');

const buildWhatsAppLink = (item: PublicProduct) => {
  if (item.waLink) return item.waLink;
  const phone = toWhatsAppPhone(item.storePhone);
  if (!phone) return '#';

  const productLabel = item.productName?.trim() || 'this item';
  const storeLabel = item.storeName?.trim() || 'your store';
  const message = `Hi! I'm interested in ${productLabel} from ${storeLabel}. (productId=${item.id}, storeId=${item.storeId ?? ''})`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
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
      const constraints: QueryConstraint[] = [where('isVisible', '==', true)];

      if (selectedCategory !== 'all') {
        constraints.push(where('categoryKey', '==', selectedCategory));
      }

      if (selectedSort === 'price') {
        constraints.push(orderBy('price', 'asc'));
        constraints.push(orderBy('publishedAt', 'desc'));
      } else if (selectedSort === 'featured') {
        constraints.push(orderBy('featuredRank', 'desc'));
        constraints.push(orderBy('publishedAt', 'desc'));
      } else {
        constraints.push(orderBy('publishedAt', 'desc'));
      }

      constraints.push(limit(PAGE_SIZE));

      const baseQuery = query(collection(db, 'publicProducts'), ...constraints);
      const pagedQuery = cursor ? query(baseQuery, startAfter(cursor)) : baseQuery;
      const snapshot = await getDocs(pagedQuery);

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
          : visibleProducts.map((item) => (
              <article key={item.id} className="card">
                <div className="imageWrap">
                  <img
                    src={item.imageUrls?.[0] ?? getFallbackImage(item.categoryKey)}
                    alt={item.productName ?? 'Product image'}
                    loading="lazy"
                  />
                </div>
                <h3>
                  <Link href={`/products/${item.id}`}>{item.productName ?? 'Untitled item'}</Link>
                </h3>
                <p>{item.description ?? 'No description yet.'}</p>
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
                {item.categoryKey ? (
                  <p>
                    <Link href={buildCategoryPath(item.categoryKey)}>{formatCategoryName(item.categoryKey)}</Link>
                  </p>
                ) : null}
                <a className="waButton" href={buildWhatsAppLink(item)} target="_blank" rel="noreferrer">
                  Contact on WhatsApp
                </a>
              </article>
            ))}
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
