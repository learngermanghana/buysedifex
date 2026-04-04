'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  QueryDocumentSnapshot,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

type PublicProduct = {
  id: string;
  productName?: string;
  description?: string;
  categoryKey?: string;
  imageUrls?: string[];
  price?: number;
  currency?: string;
  storeName?: string;
  waLink?: string;
  isVisible?: boolean;
  publishedAt?: { seconds: number };
};

const PAGE_SIZE = 12;

export function ProductGrid() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visibleProducts = useMemo(() => {
    if (selectedCategory === 'all') {
      return products;
    }
    return products.filter((product) => product.categoryKey === selectedCategory);
  }, [products, selectedCategory]);

  const categories = useMemo(() => {
    const items = new Set<string>();
    products.forEach((item) => {
      if (item.categoryKey) {
        items.add(item.categoryKey);
      }
    });

    return ['all', ...Array.from(items).sort()];
  }, [products]);

  const fetchProducts = async (cursor?: QueryDocumentSnapshot) => {
    setIsLoading(true);
    setError(null);

    try {
      const baseQuery = query(
        collection(db, 'publicProducts'),
        where('isVisible', '==', true),
        orderBy('publishedAt', 'desc'),
        limit(PAGE_SIZE),
      );

      const pagedQuery = cursor ? query(baseQuery, startAfter(cursor)) : baseQuery;
      const snapshot = await getDocs(pagedQuery);

      const nextItems = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as PublicProduct[];

      setProducts((current) => (cursor ? [...current, ...nextItems] : nextItems));
      setLastDoc(snapshot.docs.at(-1) ?? null);
    } catch (err) {
      console.error(err);
      setError('Could not load products. Check your Firebase public env vars.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return (
    <section>
      <div className="toolbar">
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
        >
          {categories.map((category) => (
            <option value={category} key={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="grid">
        {visibleProducts.map((item) => (
          <article key={item.id} className="card">
            <div className="imageWrap">
              {item.imageUrls?.[0] ? (
                <img src={item.imageUrls[0]} alt={item.productName ?? 'Product image'} />
              ) : (
                <div className="placeholder">No image</div>
              )}
            </div>
            <h3>{item.productName ?? 'Untitled product'}</h3>
            <p>{item.description ?? 'No description yet.'}</p>
            <div className="meta">
              <span>{item.storeName ?? 'Unknown store'}</span>
              <strong>
                {item.price != null ? `${item.currency ?? 'USD'} ${item.price.toFixed(2)}` : 'Price unavailable'}
              </strong>
            </div>
            <a href={item.waLink ?? '#'} target="_blank" rel="noreferrer">
              Buy on WhatsApp
            </a>
          </article>
        ))}
      </div>

      <div className="actions">
        <button type="button" disabled={!lastDoc || isLoading} onClick={() => fetchProducts(lastDoc ?? undefined)}>
          {isLoading ? 'Loading...' : 'Load more'}
        </button>
      </div>
    </section>
  );
}
