'use client';

import type { SedifexPromo } from '@sedifex/integration-types';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { trackEvent } from '@/lib/client-tracking';
import { getStoreHref } from '@/lib/store-route';

type StorePromo = SedifexPromo;

const getStorePath = (promo: StorePromo) => getStoreHref(promo.storeId ?? promo.id, promo.storeName, promo.storeSlug);

const promoMatchesCity = (promo: StorePromo, city: string) => {
  if (!city || city === 'all') return false;
  const normalizedCity = city.trim().toLowerCase();
  const haystack = [promo.promoSummary, promo.promoTitle, promo.storeName].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(normalizedCity);
};

export function PromoCarousel() {
  const [promos, setPromos] = useState<StorePromo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPromos = async () => {
      try {
        const response = await fetch('/api/integration/promos', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load promos');
        const body = (await response.json()) as { items?: StorePromo[] };

        const preferredCity = typeof window === 'undefined' ? 'all' : window.localStorage.getItem('sedifex.preferredCity') ?? 'all';
        const sourcePromos = Array.isArray(body.items) ? body.items : [];
        const cityMatched = sourcePromos.filter((promo) => promoMatchesCity(promo, preferredCity));
        setPromos(cityMatched.length > 0 ? cityMatched : sourcePromos);

        setError(null);
      } catch {
        setError('Could not load promotions at the moment.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPromos();
  }, []);

  useEffect(() => {
    if (promos.length <= 1) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % promos.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, [promos.length]);

  useEffect(() => {
    if (activeIndex >= promos.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, promos.length]);

  const activePromo = useMemo(() => promos[activeIndex], [activeIndex, promos]);

  useEffect(() => {
    if (!activePromo) return;
    void trackEvent('promo_impression', { promoId: activePromo.id, storeId: activePromo.storeId ?? null, position: activeIndex });
  }, [activePromo, activeIndex]);

  return (
    <aside className="promoRail" aria-label="Latest store promotions">
      <div className="promoRailHeader">
        <p className="eyebrow">Latest promotions</p>
        <h2>Verified store deals</h2>
      </div>

      {isLoading ? <div className="promoCard skeletonPromo" aria-hidden="true" /> : null}

      {!isLoading && error ? <p className="error">{error}</p> : null}

      {!isLoading && !error && activePromo ? (
        <article className="promoCard">
          <div className="promoImageWrap">
            <Image
              src={activePromo.promoImageUrl ?? 'https://placehold.co/640x360'}
              alt={activePromo.promoImageAlt?.trim() || activePromo.promoTitle || 'Store promotion image'}
              fill
              sizes="(max-width: 780px) 100vw, 320px"
              style={{ objectFit: 'cover' }}
            />
          </div>

          <div className="promoMeta">
            <h3>{activePromo.promoTitle ?? 'Latest promotion'}</h3>
            {activePromo.promoSummary ? <p className="promoSummary">{activePromo.promoSummary}</p> : null}
            {activePromo.promoStartDate || activePromo.promoEndDate ? (
              <p className="promoDates">{[activePromo.promoStartDate, activePromo.promoEndDate].filter(Boolean).join(' - ')}</p>
            ) : null}
          </div>

          <div className="promoActions">
            {getStorePath(activePromo) ? (
              <Link href={getStorePath(activePromo) ?? '#'} onClick={() => trackEvent('promo_click', { promoId: activePromo.id, channel: 'store' })}>
                Visit store
              </Link>
            ) : null}
            {activePromo.promoWebsiteUrl ? (
              <a href={activePromo.promoWebsiteUrl} target="_blank" rel="noreferrer" onClick={() => trackEvent('promo_click', { promoId: activePromo.id, channel: 'website' })}>
                Website
              </a>
            ) : null}
            {activePromo.promoTiktokUrl ? (
              <a href={activePromo.promoTiktokUrl} target="_blank" rel="noreferrer" onClick={() => trackEvent('promo_click', { promoId: activePromo.id, channel: 'tiktok' })}>
                TikTok
              </a>
            ) : null}
            {activePromo.promoYoutubeUrl ? (
              <a href={activePromo.promoYoutubeUrl} target="_blank" rel="noreferrer" onClick={() => trackEvent('promo_click', { promoId: activePromo.id, channel: 'youtube' })}>
                YouTube
              </a>
            ) : null}
          </div>

          {promos.length > 1 ? (
            <div className="promoControls" aria-label="Promotion slide controls">
              <button type="button" onClick={() => setActiveIndex((current) => (current - 1 + promos.length) % promos.length)}>
                Prev
              </button>
              <span>
                {activeIndex + 1}/{promos.length}
              </span>
              <button type="button" onClick={() => setActiveIndex((current) => (current + 1) % promos.length)}>
                Next
              </button>
            </div>
          ) : null}
        </article>
      ) : null}

      {!isLoading && !error && promos.length === 0 ? <p className="promoEmpty">No active promotions yet. Verified stores will appear here automatically.</p> : null}
    </aside>
  );
}
