import type { Metadata } from 'next';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(canonicalUrlForPath('/')),
  title: {
    default: 'Buy on Sedifex',
    template: '%s | Buy on Sedifex',
  },
  description: 'Public storefront for approved Sedifex products',
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
        {children}
      </body>
    </html>
  );
}
