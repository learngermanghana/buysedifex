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
      <div className="siteFooterBrand">
        <p className="siteFooterEyebrow">Verified marketplace</p>
        <p className="siteFooterTitle">Sedifex Market</p>
        <p className="siteFooterCopy">
          Shop trusted Ghanaian stores, services, and learning products with confident checkout support.
        </p>
      </div>

      <div className="siteFooterContact">
        <p className="siteFooterHeading">Need help?</p>
        <address>
          <p>Kwamisa Street, Kaneshie, Accra, Ghana</p>
          <p>
            <a href="mailto:info@sedifex.com">info@sedifex.com</a>
          </p>
          <p>
            <a href="tel:+233205706589">+233 20 570 6589</a>
          </p>
        </address>
      </div>

      <nav className="siteFooterLinks" aria-label="Legal links">
        <p className="siteFooterHeading">Marketplace links</p>
        <div>
          {legalLinks.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <p className="siteFooterCopyright">© {new Date().getFullYear()} Sedifex Market. All rights reserved.</p>
    </footer>
  );
}
