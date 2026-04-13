'use client';

import type { SedifexProduct } from '@sedifex/integration-types';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FormattedDescription } from '@/components/formatted-description';
import { trackEvent } from '@/lib/client-tracking';
import { getProductHref } from '@/lib/product-route';
import { getStoreHref } from '@/lib/store-route';

type PublicProduct = SedifexProduct;
type SortOption = 'store-diverse' | 'newest' | 'price' | 'featured';

type ProductGridProps = {
  initialSearchText?: string;
  initialCategory?: string;
  initialCity?: string;
  initialSort?: SortOption;
  initialMinPrice?: string;
  initialMaxPrice?: string;
};

type FilterToolbarProps = {
  searchText: string;
  selectedSort: SortOption;
  selectedCity: string;
  minPrice: string;
  maxPrice: string;
  cities: string[];
  onSearchTextChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  onCityChange: (value: string) => void;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
};

type CategoryChipsProps = {
  categories: string[];
  selectedCategory: string;
  isLoading: boolean;
  onSelectCategory: (category: string) => void;
};

type ProductCardProps = {
  item: PublicProduct;
  isSaved: boolean;
  isDescriptionExpanded: boolean;
  onToggleDescription: (productId: string) => void;
  onToggleSave: (item: PublicProduct) => void;
  onProductViewed: (item: PublicProduct) => void;
};

const PAGE_SIZE = 12;
const SAVED_IDS_KEY = 'sedifex.savedProductIds';
const RECENTLY_VIEWED_KEY = 'sedifex.recentlyViewedProducts';
const PRODUCTS_CACHE_KEY = 'sedifex.productsCache';

const normalizeDisplayCurrency = (currency?: string) =>
  ((currency ?? 'GHS').toUpperCase() === 'USD' ? 'GHS' : (currency ?? 'GHS').toUpperCase());
const formatPrice = (price?: number, currency?: string) =>
  price == null ? 'Price unavailable' : `${normalizeDisplayCurrency(currency) === 'GHS' ? 'Cedis (GH₵)' : normalizeDisplayCurrency(currency)} ${price.toFixed(2)}`;
const toWhatsAppPhone = (phone?: string | number) => String(phone ?? '').replace(/[^\d]/g, '');
const getContactPhone = (item: PublicProduct) => item.phone ?? item.waLink ?? '';
const buildWhatsAppLink = (item: PublicProduct) => {
  const phone = toWhatsAppPhone(getContactPhone(item));
  if (!phone) return '#';
  const message = `Hi! I'm interested in ${item.productName || 'this item'} from ${item.storeName || 'your store'}. (productId=${item.id}, storeId=${item.storeId ?? ''})`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};
const getStorePhone = (item: PublicProduct) => getContactPhone(item) || 'Phone unavailable';
const getStoreCity = (item: PublicProduct) => item.city?.trim() || 'City unavailable';
const hasDisplayImage = (item: PublicProduct) => Array.isArray(item.imageUrls) && item.imageUrls.some((url) => Boolean(url?.trim()));
const isVerifiedStore = (value: PublicProduct['verified']) => Boolean(value);

const toPositivePrice = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

function FilterToolbar({
  searchText,
  selectedSort,
  selectedCity,
  minPrice,
  maxPrice,
  cities,
  onSearchTextChange,
  onSortChange,
  onCityChange,
  onMinPriceChange,
  onMaxPriceChange,
}: FilterToolbarProps) {
  return (
    <>
      <div className="toolbar">
        <div className="searchWrap">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="search"
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="Search products, services, stores, or categories"
          />
        </div>
        <div className="sortWrap">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" value={selectedSort} onChange={(event) => onSortChange(event.target.value as SortOption)}>
            <option value="store-diverse">Mixed stores</option>
            <option value="featured">Popular</option>
            <option value="newest">Newest</option>
            <option value="price">Cheapest</option>
          </select>
        </div>
      </div>

      <div className="toolbar filterRow3">
        <div className="sortWrap">
          <label htmlFor="city-filter">City</label>
          <select id="city-filter" value={selectedCity} onChange={(event) => onCityChange(event.target.value)}>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city === 'all' ? 'All cities' : city}
              </option>
            ))}
          </select>
        </div>
        <div className="sortWrap">
          <label htmlFor="min-price">Min price</label>
          <input id="min-price" type="number" min={0} value={minPrice} onChange={(event) => onMinPriceChange(event.target.value)} placeholder="0" />
        </div>
        <div className="sortWrap">
          <label htmlFor="max-price">Max price</label>
          <input id="max-price" type="number" min={0} value={maxPrice} onChange={(event) => onMaxPriceChange(event.target.value)} placeholder="500" />
        </div>
      </div>
    </>
  );
}

function CategoryChips({ categories, selectedCategory, isLoading, onSelectCategory }: CategoryChipsProps) {
  return (
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
            disabled={isLoading}
            onClick={() => onSelectCategory(category)}
          >
            {category}
          </button>
        );
      })}
    </div>
  );
}

function ProductCard({
  item,
  isSaved,
  isDescriptionExpanded,
  onToggleDescription,
  onToggleSave,
  onProductViewed,
}: ProductCardProps) {
  const whatsappLink = buildWhatsAppLink(item);
  const canContactOnWhatsApp = whatsappLink !== '#';
  const storeHref = getStoreHref(item.storeId, item.storeName);
  const shouldCollapseDescription = (item.description?.trim().length ?? 0) > 260;
  const descriptionClassName = `formattedDescription compact ${shouldCollapseDescription && !isDescriptionExpanded ? 'isCollapsed' : ''}`.trim();

  return (
    <article className="card">
      <div className="imageWrap">
        <Image
          src={item.imageUrls?.[0] ?? 'https://placehold.co/640x640'}
          alt={item.imageAlt?.trim() || item.productName || 'Product image'}
          loading="lazy"
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          style={{ objectFit: 'cover' }}
        />
      </div>
      <h3>{item.productName ?? 'Untitled item'}</h3>
      <Link href={getProductHref(item.id, item.productName)} onClick={() => onProductViewed(item)}>
        View product details
      </Link>
      <FormattedDescription text={item.description ?? ''} className={descriptionClassName} />
      {shouldCollapseDescription ? (
        <button type="button" className="descriptionToggle" onClick={() => onToggleDescription(item.id)}>
          {isDescriptionExpanded ? 'View less' : 'View more'}
        </button>
      ) : null}
      <div className="meta">
        <span className="storeIdentity">
          {storeHref ? <Link href={storeHref}>{item.storeName ?? 'Unknown store'}</Link> : item.storeName ?? 'Unknown store'}
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
      <button type="button" className="saveButton" onClick={() => onToggleSave(item)}>
        {isSaved ? '★ Saved' : '☆ Save item'}
      </button>
      {canContactOnWhatsApp ? (
        <a
          className="waButton"
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          aria-label={`Contact ${item.storeName ?? 'store'} on WhatsApp about ${item.productName ?? 'this item'}`}
          onClick={() => trackEvent('whatsapp_click', { productId: item.id, storeId: item.storeId ?? null })}
        >
          Contact on WhatsApp
        </a>
      ) : (
        <span className="waButton" aria-disabled="true" title="WhatsApp contact unavailable">
          WhatsApp unavailable
        </span>
      )}
    </article>
  );
}

export function ProductGrid({
  initialSearchText = '',
  initialCategory = 'all',
  initialCity = 'all',
  initialSort = 'store-diverse',
  initialMinPrice = '',
  initialMaxPrice = '',
}: ProductGridProps) {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [cities, setCities] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);
  const [selectedSort, setSelectedSort] = useState<SortOption>('store-diverse');
  const [searchText, setSearchText] = useState<string>(initialSearchText);
  const [minPrice, setMinPrice] = useState<string>(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState<string>(initialMaxPrice);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [recentlyViewed, setRecentlyViewed] = useState<PublicProduct[]>([]);

  const visibleProducts = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    const min = toPositivePrice(minPrice);
    const max = toPositivePrice(maxPrice);

    return products.filter((product) => {
      const cityMatches = selectedCity === 'all' || getStoreCity(product).toLowerCase() === selectedCity.toLowerCase();
      if (!cityMatches) return false;

      if (min != null && (product.price ?? 0) < min) return false;
      if (max != null && (product.price ?? 0) > max) return false;

      if (!text) return true;
      const haystack = [product.productName, product.description, product.storeName, product.categoryKey]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(text);
    });
  }, [products, searchText, selectedCity, minPrice, maxPrice]);

  const toggleDescription = (productId: string) => {
    setExpandedDescriptionIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleSave = (item: PublicProduct) => {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SAVED_IDS_KEY, JSON.stringify(Array.from(next)));
      }

      void trackEvent('save_item', { productId: item.id, saved: next.has(item.id) });
      return next;
    });
  };

  const onProductViewed = (item: PublicProduct) => {
    void trackEvent('product_view', { productId: item.id, storeId: item.storeId ?? null });

    if (typeof window === 'undefined') return;

    const next = [item, ...recentlyViewed.filter((current) => current.id !== item.id)].slice(0, 6);
    setRecentlyViewed(next);
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  };

  const fetchCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const response = await fetch('/api/integration/categories', { cache: 'no-store' });
      const body = (await response.json()) as { items?: string[] };
      setCategories(['all', ...((body.items ?? []).sort())]);
    } catch {
      setCategories(['all']);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  const fetchProducts = async (nextPage = 1) => {
    setIsLoading(true);
    setError(null);

    const cacheKey = `${PRODUCTS_CACHE_KEY}:${selectedCategory}:${selectedSort}:${nextPage}`;

    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: String(PAGE_SIZE), sort: selectedSort });
      if (selectedCategory !== 'all') params.set('categoryKey', selectedCategory);
      const response = await fetch(`/api/integration/products?${params.toString()}`, { cache: 'no-store' });
      const body = (await response.json()) as { items?: PublicProduct[]; hasMore?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Failed to load products');

      const nextItems = (body.items ?? []).filter((item) => hasDisplayImage(item));
      setProducts((current) => (nextPage === 1 ? nextItems : [...current, ...nextItems]));
      setCities((current) => Array.from(new Set([...current, ...nextItems.map(getStoreCity)])).sort((a, b) => a.localeCompare(b)));
      setHasMore(Boolean(body.hasMore));
      setPage(nextPage);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(cacheKey, JSON.stringify({ items: nextItems, hasMore: Boolean(body.hasMore) }));
      }
    } catch (fetchError) {
      if (typeof window !== 'undefined') {
        const rawCache = window.localStorage.getItem(cacheKey);
        if (rawCache) {
          const cached = JSON.parse(rawCache) as { items?: PublicProduct[]; hasMore?: boolean };
          const cachedItems = Array.isArray(cached.items) ? cached.items : [];
          setProducts((current) => (nextPage === 1 ? cachedItems : [...current, ...cachedItems]));
          setHasMore(Boolean(cached.hasMore));
          setPage(nextPage);
          setError('Live data is currently unavailable. Showing last cached results.');
          setIsLoading(false);
          return;
        }
      }

      const message = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      setError(`Could not load products from Sedifex integration API: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedSort(initialSort);
    setSelectedCategory(initialCategory);
    setSelectedCity(initialCity);
    setSearchText(initialSearchText);
    setMinPrice(initialMinPrice);
    setMaxPrice(initialMaxPrice);
  }, [initialSort, initialCategory, initialCity, initialSearchText, initialMinPrice, initialMaxPrice]);

  useEffect(() => {
    fetchCategories();

    if (typeof window === 'undefined') return;

    const rawSaved = window.localStorage.getItem(SAVED_IDS_KEY);
    if (rawSaved) {
      setSavedIds(new Set(JSON.parse(rawSaved) as string[]));
    }

    const rawRecent = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (rawRecent) {
      setRecentlyViewed(JSON.parse(rawRecent) as PublicProduct[]);
    }
  }, []);

  useEffect(() => {
    setProducts([]);
    fetchProducts(1);
  }, [selectedCategory, selectedSort]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (searchText.trim()) params.set('q', searchText.trim());
    else params.delete('q');
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    else params.delete('category');
    if (selectedCity !== 'all') params.set('city', selectedCity);
    else params.delete('city');
    if (selectedSort !== 'store-diverse') params.set('sort', selectedSort);
    else params.delete('sort');
    if (minPrice.trim()) params.set('minPrice', minPrice.trim());
    else params.delete('minPrice');
    if (maxPrice.trim()) params.set('maxPrice', maxPrice.trim());
    else params.delete('maxPrice');

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);

    window.localStorage.setItem('sedifex.preferredCity', selectedCity);
  }, [searchText, selectedCategory, selectedCity, selectedSort, minPrice, maxPrice]);

  return (
    <section className="marketplace">
      {recentlyViewed.length > 0 ? (
        <div className="toolbar">
          <div className="sortWrap">
            <label>Recently viewed</label>
            <div className="inlineLinks">
              {recentlyViewed.map((item) => (
                <Link key={item.id} href={getProductHref(item.id, item.productName)}>
                  {item.productName}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <FilterToolbar
        searchText={searchText}
        selectedSort={selectedSort}
        selectedCity={selectedCity}
        minPrice={minPrice}
        maxPrice={maxPrice}
        cities={cities}
        onSearchTextChange={setSearchText}
        onSortChange={setSelectedSort}
        onCityChange={setSelectedCity}
        onMinPriceChange={setMinPrice}
        onMaxPriceChange={setMaxPrice}
      />

      <CategoryChips
        categories={categories}
        selectedCategory={selectedCategory}
        isLoading={isLoadingCategories}
        onSelectCategory={setSelectedCategory}
      />

      {error ? (
        <div className="errorBlock">
          <p className="error">{error}</p>
          <button type="button" onClick={() => fetchProducts(1)}>
            Retry
          </button>
        </div>
      ) : null}

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
              <ProductCard
                key={item.id}
                item={item}
                isSaved={savedIds.has(item.id)}
                isDescriptionExpanded={expandedDescriptionIds.has(item.id)}
                onToggleDescription={toggleDescription}
                onToggleSave={toggleSave}
                onProductViewed={onProductViewed}
              />
            ))}
      </div>

      {!isLoading && visibleProducts.length === 0 && !error ? (
        <div className="emptyState">
          <h3>No items found</h3>
          <p>Try a different search term, category, or sort option.</p>
        </div>
      ) : null}

      <div className="actions">
        <button type="button" disabled={!hasMore || isLoading} onClick={() => fetchProducts(page + 1)}>
          {isLoading && products.length > 0 ? 'Loading more...' : 'Load more products'}
        </button>
      </div>
    </section>
  );
}
