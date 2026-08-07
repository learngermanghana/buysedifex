'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/', label: 'Home', match: (pathname: string) => pathname === '/' },
  { href: '/products', label: 'Products', match: (pathname: string) => pathname.startsWith('/products') },
  { href: '/categories', label: 'Categories', match: (pathname: string) => pathname.startsWith('/categories') || pathname.startsWith('/category/') },
  { href: '/stores', label: 'Stores', match: (pathname: string) => pathname.startsWith('/stores') || pathname.startsWith('/businesses') },
  { href: '/search', label: 'Search', match: (pathname: string) => pathname.startsWith('/search') },
  { href: '/account', label: 'Account', match: (pathname: string) => pathname.startsWith('/account') },
  { href: '/sell', label: 'Sell on Sedifex', match: (pathname: string) => pathname.startsWith('/sell') },
];

export function MainNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <nav className="mainNav" aria-label="Primary navigation" data-open={isOpen ? 'true' : 'false'}>
      <button
        type="button"
        className="mainNavToggle"
        aria-expanded={isOpen}
        aria-controls="primary-navigation-links"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span aria-hidden="true">☰</span>
        <span>Menu</span>
      </button>
      <div className="mainNavLinks" id="primary-navigation-links">
        {navItems.map((item) => {
          const isActive = item.match(pathname);

          return (
            <Link key={item.label} href={item.href} className={isActive ? 'active' : undefined} aria-current={isActive ? 'page' : undefined}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
