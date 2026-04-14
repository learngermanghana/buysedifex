import Link from 'next/link';

type SectionTabsProps = {
  activeTab: 'products' | 'services';
};

export function SectionTabs({ activeTab }: SectionTabsProps) {
  return (
    <nav className="sectionTabs" aria-label="Browse products and services">
      <Link href="/" className={activeTab === 'products' ? 'active' : undefined} aria-current={activeTab === 'products' ? 'page' : undefined}>
        Products
      </Link>
      <Link
        href="/services"
        className={activeTab === 'services' ? 'active' : undefined}
        aria-current={activeTab === 'services' ? 'page' : undefined}
      >
        Services
      </Link>
    </nav>
  );
}
