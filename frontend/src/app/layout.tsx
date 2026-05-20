import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import { CartProvider } from '@/components/cart-provider';
import { CustomerAuthProvider } from '@/components/customer-auth-provider';
import { AutoHideSiteHeader } from '@/components/auto-hide-site-header';
import { LiveChatWidget } from '@/components/live-chat-widget';
import { SiteFooter } from '@/components/site-footer';
import { WebVitalsReporter } from '@/components/web-vitals-reporter';
import { baseSeoKeywords, canonicalUrlForPath, defaultSocialImageUrl } from '@/lib/seo';
import './globals.css';
import './marketplace-size.css';

export const metadata: Metadata = {
  metadataBase: new URL(canonicalUrlForPath('/')),
  title: {
    default: 'Sedifex Market',
    template: '%s | Sedifex Market',
  },
  description: 'Shop verified stores, products, and services on Sedifex Market.',
  keywords: baseSeoKeywords,
  alternates: {
    canonical: canonicalUrlForPath('/'),
  },
  openGraph: {
    type: 'website',
    url: canonicalUrlForPath('/'),
    title: 'Sedifex Market',
    description: 'Shop verified stores, products, and services on Sedifex Market.',
    siteName: 'Sedifex Market',
    images: [{ url: defaultSocialImageUrl() }],
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/icon.svg'],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sedifex Market',
    description: 'Shop verified stores, products, and services on Sedifex Market.',
    images: [defaultSocialImageUrl()],
  },
};

const inter = Inter({ subsets: ['latin'], variable: '--font-body' });
const sora = Sora({ subsets: ['latin'], variable: '--font-heading' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8991390842894141"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body className={`${inter.variable} ${sora.variable}`}>
        <CustomerAuthProvider>
          <CartProvider>
            <WebVitalsReporter />
            <AutoHideSiteHeader />
            {children}
            <div className="container">
              <SiteFooter />
            </div>
            <LiveChatWidget />
          </CartProvider>
        </CustomerAuthProvider>
      </body>
    </html>
  );
}
