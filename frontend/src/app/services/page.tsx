import type { Metadata } from 'next';
import Link from 'next/link';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';
import { SectionTabs } from '@/components/section-tabs';
import { serviceCatalog } from '@/lib/services-catalog';

const title = 'Services on Sedifex';
const description = 'Browse and book services from trusted providers on Sedifex.';

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalUrlForPath('/services'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/services'),
    title,
    description,
    siteName: 'Sedifex',
    images: [{ url: defaultSocialImageUrl() }],
  },
};

export default function ServicesPage() {
  return (
    <main className="container infoPage">
      <SectionTabs activeTab="services" />
      <p className="eyebrow">Services</p>
      <h1>Available services on Sedifex</h1>
      <p>Find service offers, request quotes, and chat providers directly.</p>

      <section className="grid" aria-label="Featured services">
        {serviceCatalog.map((service) => (
          <article key={service.slug} className="card">
            <p className="itemTypeBadge">Service</p>
            <h2>{service.name}</h2>
            <p>{service.summary}</p>
            <div className="productStoreActions">
              <Link href={`/services/${service.slug}`}>Book service</Link>
              <Link href={`/services/${service.slug}`}>Request quote</Link>
              <Link href={`/services/${service.slug}`}>Chat provider</Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
