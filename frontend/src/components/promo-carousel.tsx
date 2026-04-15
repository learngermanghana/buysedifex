'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { FirestoreError, collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { db, firebaseConfigError } from '@/lib/firebase';

type StorePromo = {
  id: string;
  storeName?: string;
  storeSlug?: string;
  verified?: boolean | string;
  promoTitle?: string;
  promoSummary?: string;
  promoImageUrl?: string;
  promoImageAlt?: string | null;
  promoStartDate?: string;
  promoEndDate?: string;
  promoTiktokUrl?: string | null;
  promoWebsiteUrl?: string | null;
  promoYoutubeUrl?: string | null;
};

type FirestoreTimestampLike = {
  seconds?: number;
  toDate?: () => Date;
};

const isVerifiedStore = (value: StorePromo['verified']) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  return false;
};

const coerceDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const firestoreTimestamp = value as FirestoreTimestampLike;

  if (typeof firestoreTimestamp.toDate === 'function') {
    const parsed = firestoreTimestamp.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof firestoreTimestamp.seconds === 'number') {
    const parsed = new Date(firestoreTimestamp.seconds * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

const isWithinPromoWindow = (promo: StorePromo, now: Date) => {
  const start = coerceDate(promo.promoStartDate);
  const end = coerceDate(promo.promoEndDate);
  if (!start || !end) return false;
  return start <= now && end >= now;
};

const getStorePath = (promo: StorePromo) => {
  const slug = promo.storeSlug?.trim();
  if (slug) {
    return `/stores/${encodeURIComponent(slug)}`;
  }

  return null;
};

export function PromoCarousel() {
  const [promos, setPromos] = useState<StorePromo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPromos = async () => {
      if (!db) {
        setError(firebaseConfigError ?? 'Firebase is not configured.');
        setIsLoading(false);
        return;
      }

      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      try {
        const primaryQuery = query(
          collection(db, 'stores'),
          where('promoStartDate', '<=', today),
          where('promoEndDate', '>=', today),
          orderBy('promoStartDate', 'desc'),
          limit(50),
        );

        const snapshot = await getDocs(primaryQuery);
        const items = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as StorePromo)
          .filter(
            (item) =>
              isVerifiedStore(item.verified) &&
              isWithinPromoWindow(item, now) &&
              Boolean(item.promoImageUrl?.trim()) &&
              Boolean(item.promoTitle?.trim() || item.promoSummary?.trim()),
          )
          .slice(0, 10);

        if (items.length > 0) {
          setPromos(items);
          setError(null);
          return;
        }

        const fallbackQuery = query(collection(db, 'stores'), limit(100));
        const fallbackSnapshot = await getDocs(fallbackQuery);
        const fallbackItems = fallbackSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as StorePromo)
          .filter(
            (item) =>
              isVerifiedStore(item.verified) &&
              isWithinPromoWindow(item, now) &&
              Boolean(item.promoImageUrl?.trim()) &&
              Boolean(item.promoTitle?.trim() || item.promoSummary?.trim()),
          )
          .sort((a, b) => (coerceDate(b.promoStartDate)?.getTime() ?? 0) - (coerceDate(a.promoStartDate)?.getTime() ?? 0))
          .slice(0, 10);

        setPromos(fallbackItems);
        setError(null);
      } catch (err) {
        const firestoreError = err as FirestoreError;

        if (firestoreError.code !== 'failed-precondition') {
          setError('Could not load promotions at the moment.');
          setIsLoading(false);
          return;
        }

        try {
          const fallbackQuery = query(collection(db, 'stores'), limit(100));
          const snapshot = await getDocs(fallbackQuery);
          const items = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }) as StorePromo)
            .filter(
              (item) =>
                isVerifiedStore(item.verified) &&
                isWithinPromoWindow(item, now) &&
                Boolean(item.promoImageUrl?.trim()) &&
                Boolean(item.promoTitle?.trim() || item.promoSummary?.trim()),
            )
            .sort((a, b) => (coerceDate(b.promoStartDate)?.getTime() ?? 0) - (coerceDate(a.promoStartDate)?.getTime() ?? 0))
            .slice(0, 10);

          setPromos(items);
          setError(null);
        } catch {
          setError('Could not load promotions at the moment.');
        }
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

  return (
    <aside className="promoRail" aria-label="Latest store promotions">
      <div className="promoRailHeader">
        <p className="eyebrow">Latest promotions</p>
        <h2>Verified store deals</h2>
      </div>

      {isLoading ? (
        <div className="promoCard skeletonPromo" aria-hidden="true" />
      ) : null}

      {!isLoading && error ? <p className="error">{error}</p> : null}

      {!isLoading && !error && activePromo ? (
        <article className="promoCard">
          <div className="promoImageWrap">
            <Image
              src={activePromo.promoImageUrl ?? 'https://placehold.co/640x360'}
              alt={activePromo.promoImageAlt?.trim() || activePromo.promoTitle || 'Store promotion image'}
              width={640}
              height={360}
              sizes="(max-width: 780px) 100vw, 320px"
              style={{ width: '100%', height: 'auto' }}
            />
          </div>

          <div className="promoMeta">
            <h3>{activePromo.promoTitle ?? 'Latest promotion'}</h3>
            <p className="promoSummary">{activePromo.promoSummary ?? 'Discover the latest offer from this verified store.'}</p>
            <p className="promoDates">
              {activePromo.promoStartDate} - {activePromo.promoEndDate}
            </p>
          </div>

          <div className="promoActions">
            {getStorePath(activePromo) ? <Link href={getStorePath(activePromo) ?? '#'}>Visit store</Link> : null}
            {activePromo.promoWebsiteUrl ? (
              <a href={activePromo.promoWebsiteUrl} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : null}
            {activePromo.promoTiktokUrl ? (
              <a href={activePromo.promoTiktokUrl} target="_blank" rel="noreferrer">
                TikTok
              </a>
            ) : null}
            {activePromo.promoYoutubeUrl ? (
              <a href={activePromo.promoYoutubeUrl} target="_blank" rel="noreferrer">
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

      {!isLoading && !error && promos.length === 0 ? (
        <p className="promoEmpty">No active promotions yet. Verified stores will appear here automatically.</p>
      ) : null}
    </aside>
  );
}
