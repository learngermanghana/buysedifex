import Link from 'next/link';

const footerLinks = [
  { href: '/add-product', label: 'How to add a product' },
  { href: '/contact', label: 'Contact' },
];

const legalLinks = [
  { href: '/about', label: 'About Us' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/return-policy', label: 'Return Policy' },
];

export function SiteFooter() {
  return (
    <footer className="siteFooter" aria-label="Footer links">
      <p>© {new Date().getFullYear()} Sedifex Market</p>
      <nav aria-label="Footer navigation">
        {footerLinks.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
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
