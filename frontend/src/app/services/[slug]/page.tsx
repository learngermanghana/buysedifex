import Link from 'next/link';

type ServiceDetailPageProps = {
  params: { slug: string };
};

const toTitle = (slug: string) =>
  decodeURIComponent(slug)
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export default function ServiceDetailPage({ params }: ServiceDetailPageProps) {
  const serviceName = toTitle(params.slug);

  return (
    <main className="container infoPage">
      <p className="eyebrow">Service</p>
      <h1>{serviceName}</h1>
      <p>Review this service offer, chat with the provider, and request details before booking.</p>

      <section>
        <h2>Next actions</h2>
        <div className="inlineLinks">
          <a href="#">Book service</a>
          <a href="#">Request quote</a>
          <a href="#">Chat provider</a>
        </div>
      </section>

      <div className="inlineLinks">
        <Link href="/services">Back to Services</Link>
        <Link href="/contact">Contact support</Link>
      </div>
    </main>
  );
}
