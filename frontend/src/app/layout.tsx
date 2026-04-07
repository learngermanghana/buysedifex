import type { Metadata } from 'next';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { canonicalUrlForPath } from '@/lib/seo';
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
