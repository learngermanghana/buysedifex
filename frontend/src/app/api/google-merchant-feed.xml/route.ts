import { GET as getCachedMerchantFeed } from '@/app/api/feeds/google-merchant-rss/route';

// Keep the legacy Merchant Center URL, but reuse the shared cached feed
// instead of scanning multiple Firestore collections on every request.
export const revalidate = 3600;

const FEED_URL = 'https://www.sedifexmarket.com/api/feeds/google-merchant-rss';

export async function GET() {
  const response = await getCachedMerchantFeed(new Request(FEED_URL));
  const headers = new Headers(response.headers);

  // Let Vercel serve repeat bot/Google Merchant requests from the CDN.
  headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
  headers.set('Vercel-CDN-Cache-Control', 'max-age=3600, stale-while-revalidate=86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
