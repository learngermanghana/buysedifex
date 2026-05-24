import type { Metadata } from 'next';
import Link from 'next/link';
import { ProductGrid } from '@/components/product-grid';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Sedifex Market';
const description = 'Shop products from trusted local stores in Ghana with clear seller details, secure checkout, support, delivery, and return policy information.';

const homeAdSlides = [
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
    badge: 'Upload image 2',
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
    badge: 'Sponsored slot',
    image: '/ads/home-flash-4.jpg',
    accent: '#4338ca',
  },
];

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('products ghana', 'online shopping ghana', 'verified stores ghana', 'secure checkout ghana'),
  alternates: { canonical: canonicalUrlForPath('/') },
  openGraph: { type: 'website', url: canonicalUrlForPath('/'), title, description, siteName: 'Sedifex', images: [{ url: defaultSocialImageUrl() }] },
  twitter: { card: 'summary_large_image', title, description, images: [defaultSocialImageUrl()] },
};

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
    animation: sedifexHomeAdSlide 22s infinite;
  }

  .homeAdFlash:hover .homeAdTrack {
    animation-play-state: paused;
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

  .homeAdDots span {
    width: .55rem;
    height: .55rem;
    border-radius: 999px;
    background: rgba(255,255,255,.46);
  }

  @keyframes sedifexHomeAdSlide {
    0%, 20% { transform: translateX(0); }
    25%, 45% { transform: translateX(-100%); }
    50%, 70% { transform: translateX(-200%); }
    75%, 95% { transform: translateX(-300%); }
    100% { transform: translateX(0); }
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

export default function HomePage() {
  return (
    <main className="container marketHomePage">
      <style dangerouslySetInnerHTML={{ __html: adFlashStyles }} />
      <section className="commerceHero" aria-label="Sedifex Market introduction">
        <div className="commerceHeroContent">
          <p className="eyebrow">Sedifex Market Deals</p>
          <h1>Shop trusted Ghana stores with bright deals and secure checkout.</h1>
          <p>Find products from verified sellers. View the product details, add to cart, pay securely, and keep your order record on Sedifex.</p>
          <div className="heroActions">
            <Link href="/products" className="btn btnPrimary">Shop Products</Link>
            <Link href="/services" className="btn btnSecondary">Book Services</Link>
            <Link href="/courses" className="btn btnGhost">Explore Courses</Link>
          </div>
        </div>
        <div className="commerceHeroVisual" aria-hidden="true">
          <span className="dealChip dealChipTop">Verified stores</span>
          <span className="dealChip dealChipRight">Secure checkout</span>
          <span className="dealChip dealChipBottom">Ghana marketplace</span>
          <div className="salesBurst"><span>Fresh</span><strong>Deals</strong></div>
        </div>
      </section>

      <section className="homeAdFlash" aria-label="Sedifex Market advertisement flash">
        <div className="homeAdDots" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <div className="homeAdTrack">
          {homeAdSlides.map((slide) => (
            <article key={slide.title} className="homeAdSlide" style={{ background: `linear-gradient(135deg, ${slide.accent}22, transparent 42%)` }}>
              <div className="homeAdCopy">
                <p className="eyebrow">{slide.eyebrow}</p>
                <h2>{slide.title}</h2>
                <p>{slide.text}</p>
                <div className="homeAdActions">
                  <Link href={slide.href} className="homeAdPrimary">{slide.cta}</Link>
                  <Link href="/contact" className="homeAdSecondary">Advertise product</Link>
                </div>
              </div>
              <div
                className="homeAdVisual"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${slide.accent}d9, rgba(15,23,42,.62)), url('${slide.image}')`,
                }}
                aria-label={`${slide.eyebrow} advert image area`}
              >
                <div className="homeAdBadge">
                  <span>{slide.badge}</span>
                  <span>Upload: {slide.image.replace('/ads/', '')}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="marketSectionIntro">
        <div>
          <p className="eyebrow">Start shopping</p>
          <h2>Products</h2>
        </div>
        <Link href="/products">Open more products</Link>
      </section>
      <ProductGrid itemTypeFilter="product" previewLimit={8} showToolbar={false} showPagination={false} moreHref="/products" moreLabel="Open more products" />

      <section className="marketSectionIntro">
        <div>
          <p className="eyebrow">Book trusted providers</p>
          <h2>Services</h2>
        </div>
        <Link href="/services">Open more services</Link>
      </section>
      <ProductGrid itemTypeFilter="service" previewLimit={8} showToolbar={false} showPagination={false} moreHref="/services" moreLabel="Open more services" />

      <section className="marketSectionIntro">
        <div>
          <p className="eyebrow">Learn and register</p>
          <h2>Courses</h2>
        </div>
        <Link href="/courses">Open more courses</Link>
      </section>
      <ProductGrid itemTypeFilter="course" previewLimit={8} showToolbar={false} showPagination={false} moreHref="/courses" moreLabel="Open more courses" />
    </main>
  );
}
