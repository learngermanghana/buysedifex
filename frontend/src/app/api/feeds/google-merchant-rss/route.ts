import { NextResponse } from 'next/server';
import { getProductHref } from '@/lib/product-route';
import { canonicalUrlForPath } from '@/lib/seo';
import { listIntegrationProducts } from '@/lib/sedifex-integration-api';

export const revalidate = 900;

const FEED_TITLE = 'Sedifex Product Feed';
const FEED_DESCRIPTION = 'Google Merchant compatible RSS product feed for Sedifex.';
const DEFAULT_CURRENCY = 'GHS';
const DEFAULT_CONDITION = 'new';
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGES = 20;
const PAGE_FETCH_TIMEOUT_MS = 30000;
const PAGE_FETCH_RETRY_ATTEMPTS = 3;
const PAGE_FETCH_BACKOFF_MS = 1000;

const buildFeedTitle = (storeId?: string): string =>
  storeId ? `${FEED_TITLE} - Store ${storeId}` : FEED_TITLE;

const buildFeedDescription = (storeId?: string): string =>
  storeId ? `${FEED_DESCRIPTION} Filtered for store ${storeId}.` : FEED_DESCRIPTION;

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const normalizeCurrency = (value?: string): string => {
  const normalized = value?.trim().toUpperCase();
  return normalized || DEFAULT_CURRENCY;
};

const normalizePrice = (value?: number): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value.toFixed(2);
};

const normalizeAvailability = (stockCount?: number): string => {
  if (typeof stockCount === 'number') {
    return stockCount > 0 ? 'in stock' : 'out of stock';
  }

  return 'in stock';
};

const extractStoreId = (rawStoreParam?: string | null): string | undefined => {
  const input = rawStoreParam?.trim();
  if (!input) return undefined;

  const candidate = decodeURIComponent(input).trim();
  const [storePath] = candidate.split(/[?#]/, 1);
  const pathSegments = storePath.split('/').filter(Boolean);
  const storesIndex = pathSegments.findIndex((segment) => segment === 'stores');

  if (storesIndex >= 0 && pathSegments[storesIndex + 1]) {
    return pathSegments[storesIndex + 1];
  }

  return candidate;
};

const toFeedItemXml = (item: {
  id: string;
  productName: string;
  description?: string;
  imageUrls: string[];
  price?: number;
  currency?: string;
  stockCount?: number;
  storeName?: string;
  sku?: string;
  categoryKey?: string;
}) => {
  const link = canonicalUrlForPath(getProductHref(item.id, item.productName));
  const imageLink = item.imageUrls[0];
  const priceValue = normalizePrice(item.price);
  const priceCurrency = normalizeCurrency(item.currency);

  if (!imageLink || !priceValue) {
    return null;
  }

  const lines = [
    '    <item>',
    `      <g:id>${escapeXml(item.id)}</g:id>`,
    `      <title>${escapeXml(item.productName)}</title>`,
    `      <description>${escapeXml((item.description ?? '').trim() || item.productName)}</description>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <g:image_link>${escapeXml(imageLink)}</g:image_link>`,
    `      <g:availability>${escapeXml(normalizeAvailability(item.stockCount))}</g:availability>`,
    `      <g:condition>${DEFAULT_CONDITION}</g:condition>`,
    `      <g:price>${escapeXml(`${priceValue} ${priceCurrency}`)}</g:price>`,
    `      <g:brand>${escapeXml(item.storeName?.trim() || 'Sedifex')}</g:brand>`,
  ];

  if (item.sku?.trim()) {
    lines.push(`      <g:mpn>${escapeXml(item.sku.trim())}</g:mpn>`);
  }

  if (item.categoryKey?.trim()) {
    lines.push(`      <g:product_type>${escapeXml(item.categoryKey.trim())}</g:product_type>`);
  }

  lines.push('    </item>');
  return lines.join('\n');
};

const fetchFeedItems = async (storeId?: string) => {
  const items: Array<{
    id: string;
    productName: string;
    description?: string;
    imageUrls: string[];
    price?: number;
    currency?: string;
    stockCount?: number;
    storeName?: string;
    sku?: string;
    categoryKey?: string;
  }> = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let response:
      | {
          items: Array<{
            id: string;
            productName: string;
            description?: string;
            imageUrls: string[];
            price?: number;
            currency?: string;
            stockCount?: number;
            storeName?: string;
            sku?: string;
            categoryKey?: string;
          }>;
          hasMore: boolean;
        }
      | null = null;

    for (let attempt = 1; attempt <= PAGE_FETCH_RETRY_ATTEMPTS; attempt += 1) {
      try {
        response = await Promise.race([
          listIntegrationProducts({
            storeId,
            page,
            pageSize: DEFAULT_PAGE_SIZE,
            sort: 'newest',
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  `Timed out while fetching Google Merchant feed page ${page} (attempt ${attempt}/${PAGE_FETCH_RETRY_ATTEMPTS}).`,
                ),
              );
            }, PAGE_FETCH_TIMEOUT_MS);
          }),
        ]);
        break;
      } catch (error) {
        if (attempt === PAGE_FETCH_RETRY_ATTEMPTS) {
          if (page === 1) {
            throw error;
          }
          response = null;
          break;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, PAGE_FETCH_BACKOFF_MS * attempt);
        });
      }
    }

    if (!response) {
      break;
    }

    items.push(...response.items);

    if (!response.hasMore || response.items.length === 0) {
      break;
    }
  }

  return items;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = extractStoreId(searchParams.get('storeId'));
    const products = await fetchFeedItems(storeId);
    const itemXml = products
      .map(toFeedItemXml)
      .filter((item): item is string => Boolean(item));

    const feed = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
      '  <channel>',
      `    <title>${escapeXml(buildFeedTitle(storeId))}</title>`,
      `    <link>${escapeXml(canonicalUrlForPath('/'))}</link>`,
      `    <description>${escapeXml(buildFeedDescription(storeId))}</description>`,
      ...itemXml,
      '  </channel>',
      '</rss>',
    ].join('\n');

    return new NextResponse(feed, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 's-maxage=900, stale-while-revalidate=1800',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate Google Merchant RSS feed.';

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
