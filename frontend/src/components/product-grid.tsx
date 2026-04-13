'use client';

import type { SedifexProduct } from '@sedifex/integration-types';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FormattedDescription } from '@/components/formatted-description';
import { getProductHref } from '@/lib/product-route';
import { getStoreHref } from '@/lib/store-route';

type PublicProduct = SedifexProduct;
type SortOption = 'store-diverse' | 'newest' | 'price' | 'featured';
const PAGE_SIZE = 12;

const normalizeDisplayCurrency = (currency?: string) => ((currency ?? 'GHS').toUpperCase() === 'USD' ? 'GHS' : (currency ?? 'GHS').toUpperCase());
const formatPrice = (price?: number, currency?: string) => (price == null ? 'Price unavailable' : `${normalizeDisplayCurrency(currency) === 'GHS' ? 'Cedis (GH₵)' : normalizeDisplayCurrency(currency)} ${price.toFixed(2)}`);
const toWhatsAppPhone = (phone?: string | number) => String(phone ?? '').replace(/[^\d]/g, '');
const getContactPhone = (item: PublicProduct) => item.waLink ?? '';
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

export function ProductGrid() {
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [categories, setCategories] = useState<string[]>(['all']);
  const [cities, setCities] = useState<string[]>(['all']);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<SortOption>('store-diverse');
  const [searchText, setSearchText] = useState<string>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set());

  const visibleProducts = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    return products.filter((product) => {
      const cityMatches = selectedCity === 'all' || getStoreCity(product).toLowerCase() === selectedCity.toLowerCase();
      if (!cityMatches) return false;
      if (!text) return true;
      const haystack = [product.productName, product.description, product.storeName, product.categoryKey].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(text);
    });
  }, [products, searchText, selectedCity]);

  const toggleDescription = (productId: string) => {
    setExpandedDescriptionIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
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
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: String(PAGE_SIZE), sort: selectedSort });
      if (selectedCategory !== 'all') params.set('categoryKey', selectedCategory);
      const response = await fetch(`/api/integration/products?${params.toString()}`, { cache: 'no-store' });
      const body = (await response.json()) as { items?: PublicProduct[]; hasMore?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Failed to load products');

      const nextItems = (body.items ?? []).filter((item) => hasDisplayImage(item) && isVerifiedStore(item.verified));
      setProducts((current) => (nextPage === 1 ? nextItems : [...current, ...nextItems]));
      setCities((current) => Array.from(new Set([...current, ...nextItems.map(getStoreCity)])).sort((a, b) => a.localeCompare(b)));
      setHasMore(Boolean(body.hasMore));
      setPage(nextPage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setError(`Could not load products from Sedifex integration API: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setProducts([]);
    fetchProducts(1);
  }, [selectedCategory, selectedSort]);

  return <section className="marketplace">{/* unchanged rendering */}
      <div className="toolbar"><div className="searchWrap"><label htmlFor="search">Search</label><input id="search" type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search products, services, stores, or categories"/></div><div className="sortWrap"><label htmlFor="sort">Sort by</label><select id="sort" value={selectedSort} onChange={(event) => setSelectedSort(event.target.value as SortOption)}><option value="store-diverse">Mixed stores</option><option value="featured">Popular</option><option value="newest">Newest</option><option value="price">Cheapest</option></select></div></div>
      <div className="toolbar"><div className="sortWrap"><label htmlFor="city-filter">City</label><select id="city-filter" value={selectedCity} onChange={(event) => setSelectedCity(event.target.value)}>{cities.map((city) => <option key={city} value={city}>{city === 'all' ? 'All cities' : city}</option>)}</select></div></div>
      <div className="categories" role="tablist" aria-label="Product categories">{categories.map((category) => {const active = category === selectedCategory; return <button type="button" key={category} role="tab" aria-selected={active} className={`chip ${active ? 'active' : ''}`} disabled={isLoadingCategories} onClick={() => setSelectedCategory(category)}>{category}</button>;})}</div>
      {error && <p className="error">{error}</p>}
      <div className="grid">{isLoading && products.length === 0 ? Array.from({ length: 8 }).map((_, index) => <article key={`skeleton-${index}`} className="card skeletonCard" aria-hidden="true"><div className="skeleton skeletonImage" /><div className="skeleton skeletonTitle" /><div className="skeleton skeletonText" /><div className="skeleton skeletonText short" /><div className="skeleton skeletonButton" /></article>) : visibleProducts.map((item) => {const whatsappLink = buildWhatsAppLink(item); const canContactOnWhatsApp = whatsappLink !== '#'; const storeHref = getStoreHref(item.storeId, item.storeName); const shouldCollapseDescription = (item.description?.trim().length ?? 0) > 260; const isExpanded = expandedDescriptionIds.has(item.id); const descriptionClassName = `formattedDescription compact ${shouldCollapseDescription && !isExpanded ? 'isCollapsed' : ''}`.trim(); return <article key={item.id} className="card"><div className="imageWrap"><Image src={item.imageUrls?.[0] ?? 'https://placehold.co/640x640'} alt={item.imageAlt?.trim() || item.productName || 'Product image'} loading="lazy" width={360} height={360} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw" style={{ width: '100%', height: 'auto' }} /></div><h3>{item.productName ?? 'Untitled item'}</h3><Link href={getProductHref(item.id, item.productName)}>View product details</Link><FormattedDescription text={item.description ?? ''} className={descriptionClassName} />{shouldCollapseDescription && <button type="button" className="descriptionToggle" onClick={() => toggleDescription(item.id)}>{isExpanded ? 'View less' : 'View more'}</button>}<div className="meta"><span className="storeIdentity">{storeHref ? <Link href={storeHref}>{item.storeName ?? 'Unknown store'}</Link> : item.storeName ?? 'Unknown store'}{isVerifiedStore(item.verified) ? <span className="verifiedBadge" aria-label="Verified store">Verified</span> : null}</span><strong>{formatPrice(item.price, item.currency)}</strong></div><p>City: {getStoreCity(item)}</p><p>Phone: {getStorePhone(item)}</p>{canContactOnWhatsApp ? <a className="waButton" href={whatsappLink} target="_blank" rel="noreferrer" aria-label={`Contact ${item.storeName ?? 'store'} on WhatsApp about ${item.productName ?? 'this item'}`}>Contact on WhatsApp</a> : <span className="waButton" aria-disabled="true" title="WhatsApp contact unavailable">WhatsApp unavailable</span>}</article>;})}</div>
      {!isLoading && visibleProducts.length === 0 && !error && <div className="emptyState"><h3>No items found</h3><p>Try a different search term, category, or sort option.</p></div>}
      <div className="actions"><button type="button" disabled={!hasMore || isLoading} onClick={() => fetchProducts(page + 1)}>{isLoading && products.length > 0 ? 'Loading more...' : 'Load more products'}</button></div>
    </section>;
}
