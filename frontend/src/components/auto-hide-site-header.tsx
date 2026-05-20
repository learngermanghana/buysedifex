'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AccountNavButton } from '@/components/account-nav-button';
import { CartNavButton } from '@/components/cart-provider';
import { MainNav } from '@/components/main-nav';

const MIN_SCROLL_BEFORE_HIDE = 96;
const SCROLL_DELTA_THRESHOLD = 8;

export function AutoHideSiteHeader() {
  const pathname = usePathname();
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;
    setIsHidden(false);
  }, [pathname]);

  useEffect(() => {
    let ticking = false;

    const updateHeaderVisibility = () => {
      const currentScrollY = Math.max(window.scrollY, 0);
      const previousScrollY = lastScrollYRef.current;
      const delta = currentScrollY - previousScrollY;

      if (currentScrollY <= MIN_SCROLL_BEFORE_HIDE) {
        setIsHidden(false);
      } else if (Math.abs(delta) >= SCROLL_DELTA_THRESHOLD) {
        setIsHidden(delta > 0);
        lastScrollYRef.current = currentScrollY;
      }

      ticking = false;
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateHeaderVisibility);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className="siteHeader"
      data-hidden={isHidden ? 'true' : 'false'}
      onFocus={() => setIsHidden(false)}
      onMouseEnter={() => setIsHidden(false)}
    >
      <div className="container siteHeaderInner">
        <Link href="/" className="siteBrand" aria-label="Sedifex Market home">
          <Image src="/sedifex-logo.svg" alt="Sedifex logo" width={32} height={32} priority />
          <span>Sedifex Market</span>
        </Link>
        <div className="siteHeaderActions">
          <MainNav />
          <AccountNavButton />
          <CartNavButton />
        </div>
      </div>
    </header>
  );
}
