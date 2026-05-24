'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, increment, limit, query, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type HomeAdSlide = {
  id?: string;
  eyebrow: string;
  title: string;
  text: string;
  href: string;
  cta: string;
  badge: string;
  image: string;
  accent: string;
  sponsoredBy?: string;
  status?: string;
  placement?: string;
  priority?: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

const fallbackSlides: HomeAdSlide[] = [
  {
    eyebrow: 'Sedifex Flash Deals',
    title: 'Advertise quality products customers can trust.',
    text: 'Show strong product images, clear prices, seller details, delivery options, and secure checkout records in one beautiful spot.',
    href: '/products',
    cta: 'Shop products',
    badge: 'Premium product ads',
    image: '/ads/home-flash-1.jpg',
    accent: '#ff7a00',
  },
  {
    eyebrow: 'Beauty & skincare spotlight',
    title: 'Feature skincare, makeup, fashion, and beauty products.',
    text: 'Use this flash space to promote selected products from verified Ghana stores and push buyers directly to checkout.',
    href: '/category/beauty',
    cta: 'Explore beauty deals',
    badge: 'Sponsored slot',
    image: '/ads/home-flash-2.jpg',
    accent: '#ec4899',
  },
  {
    eyebrow: 'Clear delivery promise',
    title: 'Promote products with delivery and pickup information.',
    text: 'Customers see how orders work before they buy: same-day delivery before 4 PM where available, tomorrow delivery, or pickup.',
    href: '/shipping-delivery-policy',
    cta: 'See delivery info',
    badge: 'Delivery ready',
    image: '/ads/home-flash-3.jpg',
    accent: '#10b981',
  },
  {
    eyebrow: 'Advertise on Sedifex',
    title: 'Turn this homepage space into paid product advertising.',
    text: 'Use high-quality ad images for partner stores, new arrivals, seasonal offers, sponsored products, and special marketplace campaigns.',
    href: '/contact',
    cta: 'Advertise here',
    badge: 'Advertise with us',
    image: '/ads/home-flash-4.jpg',
    accent: '#4338ca',
  },
];

const adFlashStyles = `
  .homeAdFlash {
    position: relative;
    overflow: hidden;
    border-radius: 1.3rem;
    border: 1px solid rgba(255, 122, 0, .24);
    background: #111827;
    box-shadow: 0 24px 60px -38px rgba(15,23,42,.95);
  }

  .homeAdTrack {
    display: flex;
    width: 100%;
    transition: transform .68s cubic-bezier(.2,.8,.2,1);
  }

  .homeAdSlide {
    position: relative;
    min-width: 100%;
    min-height: clamp(270px, 36vw, 430px);
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, .78fr);
    gap: clamp(1rem, 3vw, 2rem);
    align-items: stretch;
    padding: clamp(1rem, 3vw, 2rem);
    isolation: isolate;
  }

  .homeAdSlide::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -2;
    background: radial-gradient(circle at 18% 18%, rgba(255,255,255,.24), transparent 31%), linear-gradient(135deg, #111827, #172033 52%, #0f172a);
  }

  .homeAdSlide::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    opacity: .22;
    background: linear-gradient(120deg, transparent 0 40%, rgba(255,255,255,.72) 48%, transparent 58%);
    transform: translateX(-80%);
    animation: sedifexAdShine 4.8s ease-in-out infinite;
  }

  .homeAdCopy {
    display: grid;
    align-content: center;
    justify-items: start;
    gap: .75rem;
    color: #fff;
    max-width: 720px;
  }

  .homeAdCopy .eyebrow {
    color: #ffbd3d;
  }

  .homeAdCopy h2 {
    margin: 0;
    color: #fff;
    font-size: clamp(2rem, 5vw, 4.2rem);
    line-height: .95;
    letter-spacing: -.06em;
  }

  .homeAdCopy p:not(.eyebrow) {
    margin: 0;
    color: #e5e7eb;
    font-size: clamp(.96rem, 1.6vw, 1.08rem);
    line-height: 1.55;
  }

  .homeAdActions {
    display: flex;
    flex-wrap: wrap;
    gap: .65rem;
    margin-top: .25rem;
  }

  .homeAdPrimary,
  .homeAdSecondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.7rem;
    border-radius: 999px;
    padding: .72rem 1rem;
    font-weight: 950;
    text-decoration: none;
  }

  .homeAdPrimary {
    color: #111827;
    background: #ffbd3d;
    box-shadow: 0 18px 34px -22px #ffbd3d;
  }

  .homeAdSecondary {
    color: #fff;
    border: 1px solid rgba(255,255,255,.25);
    background: rgba(255,255,255,.09);
  }

  .homeAdVisual {
    position: relative;
    min-height: 260px;
    border-radius: 1.1rem;
    overflow: hidden;
    background-size: cover;
    background-position: center;
    border: 1px solid rgba(255,255,255,.18);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 22px 45px -32px rgba(0,0,0,.9);
  }

  .homeAdVisual::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 0 46%, rgba(15,23,42,.92) 100%);
  }

  .homeAdBadge {
    position: absolute;
    left: 1rem;
    right: 1rem;
    bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: .75rem;
    color: #fff;
    font-weight: 950;
  }

  .homeAdBadge span {
    display: inline-flex;
    border-radius: 999px;
    padding: .5rem .7rem;
    background: rgba(255,255,255,.14);
    border: 1px solid rgba(255,255,255,.18);
    backdrop-filter: blur(10px);
  }

  .homeAdDots {
    position: absolute;
    right: 1rem;
    top: 1rem;
    display: flex;
    gap: .35rem;
    z-index: 2;
  }

  .homeAdDots button {
    width: .62rem;
    height: .62rem;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: rgba(255,255,255,.42);
    cursor: pointer;
  }

  .homeAdDots button[data-active='true'] {
    width: 1.5rem;
    background: #ffbd3d;
  }

  @keyframes sedifexAdShine {
    0%, 52% { transform: translateX(-85%); opacity: 0; }
    64% { opacity: .24; }
    100% { transform: translateX(85%); opacity: 0; }
  }

  @media (max-width: 760px) {
    .homeAdSlide {
      grid-template-columns: 1fr;
      min-height: auto;
    }

    .homeAdVisual {
      min-height: 190px;
      order: -1;
    }
  }
`;

function isLiveAdvert(slide: HomeAdSlide) {
  if ((slide.placement || 'home_flash') !== 'home_flash') return false;
  if ((slide.status || 'active').toLowerCase() !== 'active') return false;

  const now = Date.now();
  const start = slide.startsAt ? Date.parse(slide.startsAt) : null;
  const end = slide.endsAt ? Date.parse(slide.endsAt) : null;

  if (start && Number.isFinite(start) && start > now) return false;
  if (end && Number.isFinite(end) && end < now) return false;
  return true;
}

function toSlide(id: string, value: Record<string, unknown>): HomeAdSlide | null {
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  if (!title || !text) return null;

  return {
    id,
    eyebrow: typeof value.eyebrow === 'string' && value.eyebrow.trim() ? value.eyebrow.trim() : 'Sedifex Flash Deals',
    title,
    text,
    href: typeof value.href === 'string' && value.href.trim() ? value.href.trim() : '/products',
    cta: typeof value.ctaLabel === 'string' && value.ctaLabel.trim() ? value.ctaLabel.trim() : 'Shop now',
    badge: typeof value.badge === 'string' && value.badge.trim() ? value.badge.trim() : 'Sponsored',
    image: typeof value.imageUrl === 'string' && value.imageUrl.trim() ? value.imageUrl.trim() : '',
    accent: typeof value.accent === 'string' && value.accent.trim() ? value.accent.trim() : '#ff7a00',
    sponsoredBy: typeof value.sponsoredBy === 'string' ? value.sponsoredBy.trim() : undefined,
    status: typeof value.status === 'string' ? value.status.trim() : 'active',
    placement: typeof value.placement === 'string' ? value.placement.trim() : 'home_flash',
    priority: typeof value.priority === 'number' ? value.priority : Number(value.priority) || 10,
    startsAt: typeof value.startsAt === 'string' ? value.startsAt : null,
    endsAt: typeof value.endsAt === 'string' ? value.endsAt : null,
  };
}

export function HomeAdFlash() {
  const [slides, setSlides] = useState<HomeAdSlide[]>(fallbackSlides);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadAdverts() {
      if (!db) return;

      try {
        const snapshot = await getDocs(query(collection(db, 'marketplaceAdverts'), limit(50)));
        const liveSlides = snapshot.docs
          .map((item) => toSlide(item.id, item.data() as Record<string, unknown>))
          .filter((item): item is HomeAdSlide => Boolean(item))
          .filter(isLiveAdvert)
          .sort((left, right) => (left.priority || 10) - (right.priority || 10));

        if (!cancelled && liveSlides.length > 0) {
          setSlides(liveSlides);
          setActiveIndex(0);
        }
      } catch (error) {
        console.warn('Unable to load marketplace adverts', error);
      }
    }

    void loadAdverts();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 5800);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const activeSlide = slides[activeIndex] ?? slides[0];

  const trackAdvertClick = async (slide: HomeAdSlide) => {
    if (!db || !slide.id) return;
    try {
      await updateDoc(doc(db, 'marketplaceAdverts', slide.id), { clickCount: increment(1) });
    } catch (error) {
      console.warn('Unable to track advert click', error);
    }
  };

  const renderedSlides = useMemo(() => slides.length > 0 ? slides : fallbackSlides, [slides]);

  return (
    <section className="homeAdFlash" aria-label="Sedifex Market advertisement flash">
      <style dangerouslySetInnerHTML={{ __html: adFlashStyles }} />
      <div className="homeAdDots" aria-hidden="true">
        {renderedSlides.map((slide, index) => (
          <button key={`${slide.title}-${index}`} type="button" data-active={index === activeIndex} onClick={() => setActiveIndex(index)} />
        ))}
      </div>
      <div className="homeAdTrack" style={{ transform: `translateX(-${Math.min(activeIndex, renderedSlides.length - 1) * 100}%)` }}>
        {renderedSlides.map((slide, index) => (
          <article key={`${slide.title}-${index}`} className="homeAdSlide" style={{ background: `linear-gradient(135deg, ${slide.accent}22, transparent 42%)` }}>
            <div className="homeAdCopy">
              <p className="eyebrow">{slide.eyebrow}</p>
              <h2>{slide.title}</h2>
              <p>{slide.text}</p>
              <div className="homeAdActions">
                <Link href={slide.href} className="homeAdPrimary" onClick={() => trackAdvertClick(slide)}>{slide.cta}</Link>
                <Link href="/contact" className="homeAdSecondary">Advertise product</Link>
              </div>
            </div>
            <div
              className="homeAdVisual"
              style={{
                backgroundImage: `linear-gradient(135deg, ${slide.accent}d9, rgba(15,23,42,.62))${slide.image ? `, url('${slide.image}')` : ''}`,
              }}
              aria-label={`${slide.eyebrow} advert image area`}
            >
              <div className="homeAdBadge">
                <span>{slide.badge}</span>
                <span>{slide.sponsoredBy ? `By ${slide.sponsoredBy}` : activeSlide?.id ? 'Sponsored' : 'Sedifex Market'}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
