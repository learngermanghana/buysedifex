import Link from 'next/link';

const legalLinks = [
  { href: '/terms', label: 'Terms and Conditions' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/return-policy', label: 'Return and Refund Policy' },
  { href: '/shipping-delivery-policy', label: 'Shipping and Delivery Policy' },
  { href: '/contact', label: 'Contact Us' },
  { href: '/about', label: 'About Us' },
];

export function SiteFooter() {
  return (
    <footer className="siteFooter" aria-label="Footer links">
      <p>© {new Date().getFullYear()} Sedifex Market</p>
      <address>
        <p>Kwamisa Street, Kaneshie, Accra, Ghana</p>
        <p>
          <a href="mailto:info@sedifex.com">info@sedifex.com</a>
        </p>
        <p>
          <a href="tel:+233205706589">+233205706589</a>
        </p>
      </address>
      <nav aria-label="Legal links">
        {legalLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
