'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home', match: (pathname: string) => pathname === '/' },
  { href: '/search', label: 'Products', match: (pathname: string) => pathname.startsWith('/search') || pathname.startsWith('/products') },
  { href: '/services', label: 'Service', match: (pathname: string) => pathname.startsWith('/services') },
  { href: '/stores', label: 'Stores', match: (pathname: string) => pathname.startsWith('/stores') },
  { href: '/categories', label: 'Categories', match: (pathname: string) => pathname.startsWith('/category') || pathname.startsWith('/categories') },
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
