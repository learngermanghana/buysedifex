import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';
import { getServiceBySlug, serviceCatalog } from '@/lib/services-catalog';

type ServicePageProps = { params: { slug: string } };

export async function generateStaticParams() {
  return serviceCatalog.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const service = getServiceBySlug(params.slug);

  if (!service) {
    return { title: 'Service not found | Sedifex', robots: { index: false, follow: false } };
  }

  const title = `${service.name} | Services | Sedifex`;
  const description = service.summary;
  const canonical = canonicalUrlForPath(`/services/${service.slug}`);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      title,
      description,
      siteName: 'Sedifex',
      images: [{ url: defaultSocialImageUrl() }],
    },
  };
}

export default function ServiceDetailPage({ params }: ServicePageProps) {
  const service = getServiceBySlug(params.slug);

  if (!service) {
    notFound();
  }

  return (
    <main className="container infoPage">
      <p className="itemTypeBadge">Service</p>
      <h1>{service.name}</h1>
      <p>{service.description}</p>
      <div className="inlineLinks">
        <Link href="/contact">Book service</Link>
        <Link href="/contact">Request quote</Link>
        <Link href="/contact">Chat provider</Link>
      </div>
    </main>
  );
}
