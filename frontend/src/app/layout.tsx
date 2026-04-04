import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'buy.sedifex.com',
  description: 'Public storefront for approved Sedifex products',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
