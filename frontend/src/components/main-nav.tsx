'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home', match: (pathname: string) => pathname === '/' },
  { href: '/products', label: 'Products', match: (pathname: string) => pathname.startsWith('/products') },
  { href: '/services', label: 'Services', match: (pathname: string) => pathname.startsWith('/services') },
  { href: '/courses', label: 'Courses', match: (pathname: string) => pathname.startsWith('/courses') },
  { href: '/stores', label: 'Stores', match: (pathname: string) => pathname.startsWith('/stores') },
  { href: '/search', label: 'Search', match: (pathname: string) => pathname.startsWith('/search') },
  { href: '/account', label: 'Account', match: (pathname: string) => pathname.startsWith('/account') },
  { href: '/sell', label: 'Sell on Sedifex', match: (pathname: string) => pathname.startsWith('/sell') },
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
