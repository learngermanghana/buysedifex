'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home', match: (pathname: string) => pathname === '/' },
  {
    href: '/products',
    label: 'Products',
    match: (pathname: string) => pathname.startsWith('/products') || pathname.startsWith('/search'),
  },
  { href: '/services', label: 'Services', match: (pathname: string) => pathname.startsWith('/services') },
  { href: '/sell', label: 'How to Sell', match: (pathname: string) => pathname.startsWith('/sell') },
  { href: '/contact', label: 'Contact', match: (pathname: string) => pathname.startsWith('/contact') },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="mainNav" aria-label="Primary navigation">
      {navItems.map((item) => {
        const isActive = item.match(pathname);

        return (
          <Link key={item.label} href={item.href} className={isActive ? 'active' : undefined} aria-current={isActive ? 'page' : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
