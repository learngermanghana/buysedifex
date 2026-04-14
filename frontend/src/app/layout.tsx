import type { Metadata } from 'next';
import { MainNav } from '@/components/main-nav';
import { SiteFooter } from '@/components/site-footer';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { baseSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(canonicalUrlForPath('/')),
  title: {
    default: 'Buy on Sedifex',
    template: '%s | Buy on Sedifex',
  },
  description: 'Public storefront for approved Sedifex products',
  keywords: baseSeoKeywords,
  alternates: {
    canonical: canonicalUrlForPath('/'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/'),
    title: 'Buy on Sedifex',
    description: 'Public storefront for approved Sedifex products',
    siteName: 'Sedifex',
    images: [{ url: defaultSocialImageUrl() }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Buy on Sedifex',
    description: 'Public storefront for approved Sedifex products',
    images: [defaultSocialImageUrl()],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebVitalsReporter />
        <header className="siteHeader">
          <div className="container siteHeaderInner">
            <p className="siteBrand">Sedifex Market</p>
            <MainNav />
          </div>
        </header>
        {children}
        <div className="container">
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
