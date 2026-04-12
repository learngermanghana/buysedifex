import type { Metadata } from 'next';
import Link from 'next/link';
import { buildSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';

const title = 'Sedifex: Products and services from trusted businesses';
const description =
  'Browse Products and Services on Sedifex, discover trusted businesses, and start conversations with sellers and providers fast.';

const featuredProducts = [
  {
    name: 'Organic Shea Body Butter',
    business: 'Glow Basket',
    cta: ['Chat seller', 'Request product', 'Ask about delivery'],
  },
  {
    name: 'Bluetooth Home Speaker',
    business: 'Apex Gadget Hub',
    cta: ['Chat seller', 'Request product', 'Ask about delivery'],
  },
];

const featuredServices = [
  {
    name: 'Home Deep Cleaning',
    business: 'Sparkline Cleaners',
    cta: ['Book service', 'Request quote', 'Chat provider'],
  },
  {
    name: 'Bridal Makeup Session',
    business: 'Ama Artistry Studio',
    cta: ['Book service', 'Request quote', 'Chat provider'],
  },
];

const popularCategories = ['Beauty', 'Electronics', 'Home Care', 'Fashion', 'Repairs', 'Events'];

export const metadata: Metadata = {
  title,
  description,
  keywords: buildSeoKeywords('products', 'services', 'trusted businesses', 'buy and book online'),
  alternates: {
    canonical: canonicalUrlForPath('/'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/'),
    title,
    description,
    siteName: 'Sedifex',
    images: [{ url: defaultSocialImageUrl() }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [defaultSocialImageUrl()],
  },
};

export default function HomePage() {
  return (
    <main className="container">
      <header className="hero">
        <div
          className="heroImage"
          role="img"
          aria-label="Seller and service provider tools used to manage customer requests"
        />
        <div className="heroContent">
          <p className="eyebrow">Sedifex Marketplace</p>
          <h1>Hero search for products and services</h1>
          <p>Find physical items and service offers from trusted businesses in seconds.</p>
          <form className="heroSearch" role="search">
            <input type="search" placeholder="Search products, services, or businesses" aria-label="Search Sedifex" />
            <button type="submit">Search</button>
          </form>
          <div className="inlineLinks" aria-label="Browse products and services">
            <Link href="/products">Browse Products</Link>
            <Link href="/services">Browse Services</Link>
          </div>
        </div>
      </header>

      <section className="homeSection">
        <h2>Featured Products</h2>
        <div className="launchCardGrid">
          {featuredProducts.map((item) => (
            <article key={item.name} className="launchCard">
              <span className="typeBadge">Product</span>
              <h3>{item.name}</h3>
              <p>{item.business}</p>
              <div className="miniCtas">
                {item.cta.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="homeSection">
        <h2>Featured Services</h2>
        <div className="launchCardGrid">
          {featuredServices.map((item) => (
            <article key={item.name} className="launchCard">
              <span className="typeBadge service">Service</span>
              <h3>{item.name}</h3>
              <p>{item.business}</p>
              <div className="miniCtas">
                {item.cta.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="homeSection">
        <h2>Popular Categories</h2>
        <div className="categories" aria-label="Popular categories">
          {popularCategories.map((category) => (
            <Link key={category} href="/products" className="chip">
              {category}
            </Link>
          ))}
        </div>
      </section>

      <section className="homeSection">
        <h2>Trusted Businesses</h2>
        <p>Verified businesses are highlighted so buyers can confidently connect and complete deals.</p>
      </section>

      <section className="homeSection">
        <h2>How Sedifex Works</h2>
        <ol>
          <li>Search and discover products or services.</li>
          <li>Open a listing and confirm details.</li>
          <li>Chat, request, or book directly with the business.</li>
        </ol>
      </section>
    </main>
  );
}
