'use client';

import { useEffect, useMemo, useState } from 'react';
import {
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
  featuredRank?: number;
  publishedAt?: { seconds: number };
};

type SortOption = 'newest' | 'price' | 'featured';

const PAGE_SIZE = 12;

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

  const visibleProducts = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    if (!text) {
      return products;
    }

    return products.filter((product) => {
      const haystack = [product.productName, product.description, product.storeName, product.categoryKey]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(text);
    });
  }, [products, searchText]);

  const fetchCategories = async () => {
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
      console.error(err);
      setCategories(['all']);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchProducts = async (cursor?: QueryDocumentSnapshot) => {
    setIsLoading(true);
    setError(null);

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
      console.error(err);
      setError('Could not load products. Check your Firebase public env vars and Firestore indexes.');
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
    <section>
      <div className="toolbar">
        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={selectedCategory}
          disabled={isLoadingCategories}
          onChange={(event) => setSelectedCategory(event.target.value)}
        >
          {categories.map((category) => (
            <option value={category} key={category}>
              {category}
            </option>
          ))}
        </select>

        <label htmlFor="sort">Sort</label>
        <select id="sort" value={selectedSort} onChange={(event) => setSelectedSort(event.target.value as SortOption)}>
          <option value="newest">Newest</option>
          <option value="price">Price</option>
          <option value="featured">Featured</option>
        </select>

        <label htmlFor="search">Search</label>
        <input
          id="search"
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search products"
        />
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
