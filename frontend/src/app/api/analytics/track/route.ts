import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { db, firebaseConfigError } from '@/lib/firebase';

export const runtime = 'nodejs';

type AnalyticsBody = {
  eventName?: unknown;
  site?: unknown;
  sessionId?: unknown;
  visitorId?: unknown;
  pageUrl?: unknown;
  pagePath?: unknown;
  pageTitle?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmTerm?: unknown;
  utmContent?: unknown;
  storeId?: unknown;
  storeName?: unknown;
  productId?: unknown;
  productName?: unknown;
  searchTerm?: unknown;
  actionTarget?: unknown;
  metadata?: unknown;
};

const ALLOWED_EVENTS = new Set([
  'page_view',
  'store_view',
  'product_view',
  'search',
  'add_to_cart',
  'checkout_started',
  'payment_initialized',
  'order_paid',
  'whatsapp_click',
  'phone_click',
  'seller_profile_click',
  'support_click',
]);

function clean(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function cleanObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
    if (typeof item === 'string') output[key] = item.slice(0, 500);
    else if (typeof item === 'number' || typeof item === 'boolean' || item === null) output[key] = item;
  }
  return output;
}

function deviceFromUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|android|iphone|phone/.test(ua)) return 'mobile';
  return 'desktop';
}

function sourceFromReferrer(referrer: string, utmSource: string) {
  const source = utmSource.toLowerCase();
  if (source) return source;
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase();
    if (host.includes('google.')) return 'google';
    if (host.includes('facebook.') || host.includes('fb.')) return 'facebook';
    if (host.includes('instagram.')) return 'instagram';
    if (host.includes('tiktok.')) return 'tiktok';
    if (host.includes('wa.me') || host.includes('whatsapp.')) return 'whatsapp';
    return host;
  } catch {
    return 'referral';
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/analytics/track',
    method: 'POST',
    collection: 'analyticsEvents',
    events: Array.from(ALLOWED_EVENTS),
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!db || firebaseConfigError) {
      return NextResponse.json({ ok: false, error: firebaseConfigError || 'Firebase is not configured.' }, { status: 500 });
    }

    const body = await request.json().catch(() => null) as AnalyticsBody | null;
    if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });

    const eventName = clean(body.eventName, 80);
    if (!ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json({ ok: false, error: 'Unsupported analytics event.', eventName }, { status: 400 });
    }

    const headers = request.headers;
    const userAgent = clean(headers.get('user-agent'), 700);
    const country = clean(headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry') || headers.get('x-country-code'), 20) || 'unknown';
    const region = clean(headers.get('x-vercel-ip-country-region') || headers.get('x-region-code'), 80);
    const city = clean(headers.get('x-vercel-ip-city') || headers.get('x-city'), 120);
    const referrer = clean(body.referrer, 1000) || clean(headers.get('referer'), 1000);
    const utmSource = clean(body.utmSource, 120);
    const pageUrl = clean(body.pageUrl, 1000);
    const pagePath = clean(body.pagePath, 500);
    const trafficSource = sourceFromReferrer(referrer, utmSource);

    const payload = {
      eventName,
      site: clean(body.site, 80) || 'sedifexmarket',
      sessionId: clean(body.sessionId, 160) || null,
      visitorId: clean(body.visitorId, 160) || null,
      pageUrl: pageUrl || null,
      pagePath: pagePath || null,
      pageTitle: clean(body.pageTitle, 300) || null,
      referrer: referrer || null,
      trafficSource,
      utmSource: utmSource || null,
      utmMedium: clean(body.utmMedium, 120) || null,
      utmCampaign: clean(body.utmCampaign, 180) || null,
      utmTerm: clean(body.utmTerm, 180) || null,
      utmContent: clean(body.utmContent, 180) || null,
      storeId: clean(body.storeId, 180) || null,
      storeName: clean(body.storeName, 220) || null,
      productId: clean(body.productId, 220) || null,
      productName: clean(body.productName, 220) || null,
      searchTerm: clean(body.searchTerm, 220) || null,
      actionTarget: clean(body.actionTarget, 700) || null,
      device: deviceFromUserAgent(userAgent),
      country,
      region: region || null,
      city: city || null,
      userAgent,
      metadata: cleanObject(body.metadata),
      createdAt: serverTimestamp(),
      createdAtIso: new Date().toISOString(),
    };

    await addDoc(collection(db, 'analyticsEvents'), payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('analytics.track.failed', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to track analytics event.' }, { status: 500 });
  }
}
