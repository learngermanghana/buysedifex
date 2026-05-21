import { NextResponse } from 'next/server';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db, firebaseConfigError } from '@/lib/firebase';
import { getProductHref } from '@/lib/product-route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SITE_URL = 'https://www.sedifexmarket.com';
const MARKETPLACE_COLLECTIONS = ['publicListings', 'publicProducts', 'publicServices'] as const;
const FEED_LIMIT_PER_COLLECTION = 900;
const PLACEHOLDER_IMAGE_HOSTS = ['placehold.co', 'placeholder.com'];

type PublicListing = {
  id: string;
  storeId?: string;
  productId?: string;
  productName?: string;
  name?: string;
  description?: string | null;
  category?: string | null;
  categoryName?: string | null;
  categoryKey?: string | null;
  imageUrls?: string[] | string | null;
  imageUrl?: string | null;
  image?: string | null;
  thumbnailUrl?: string | null;
  photoUrl?: string | null;
  images?: string[] | string | null;
  imageAlt?: string | null;
  price?: number | null;
  currency?: string | null;
  sku?: string | null;
  barcode?: string | null;
  manufacturerName?: string | null;
  storeName?: string | null;
  storeStatus?: string | null;
  itemType?: string | null;
  listingType?: string | null;
  status?: string | null;
  verified?: boolean | string | number | null;
  marketplaceApproved?: boolean | string | number | null;
  approvedForMarketplace?: boolean | string | number | null;
  isMarketplaceApproved?: boolean | string | number | null;
  marketplaceApprovalStatus?: string | null;
  approvalStatus?: string | null;
  verificationStatus?: string | null;
  googleMerchantApproved?: boolean | string | number | null;
  googleMerchantApprovalStatus?: string | null;
  eligibleForBuy?: boolean | string | number | null;
  buyOptOut?: boolean | string | number | null;
  hidden?: boolean | string | number | null;
  isHidden?: boolean | string | number | null;
  deleted?: boolean | string | number | null;
  isDeleted?: boolean | string | number | null;
  visible?: boolean | string | number | null;
  isVisible?: boolean | string | number | null;
  isPublished?: boolean | string | number | null;
  isMarketplaceVisible?: boolean | string | number | null;
  stockCount?: number | null;
};

function xml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function compactText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value
    .replace(/\*\*/g, '')
    .replace(/^(product\s*name|service\s*name|course\s*name|item\s*name|name|title)\s*:\s*/i, '')
    .replace(/^[-–—:\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).replace(/\s+\S*$/, '').trim()}…`;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'approved', 'verified', 'active', 'published', 'visible'].includes(normalized)) return true;
    if (['false', '0', 'no', 'rejected', 'blocked', 'disabled', 'inactive', 'hidden', 'draft'].includes(normalized)) return false;
  }
  return null;
}

function normalizeStatus(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, '_') : '';
}

function isTrue(value: unknown): boolean {
  return normalizeBoolean(value) === true;
}

function isFalse(value: unknown): boolean {
  return normalizeBoolean(value) === false;
}

function listingType(item: PublicListing): string {
  return (item.listingType || item.itemType || 'product').trim().toLowerCase();
}

function isPhysicalProduct(item: PublicListing): boolean {
  const type = listingType(item);
  return type === 'product' || type === 'made_to_order' || type === 'retail';
}

function isApprovedStore(item: PublicListing): boolean {
  const explicitApproval =
    normalizeBoolean(item.marketplaceApproved) ??
    normalizeBoolean(item.approvedForMarketplace) ??
    normalizeBoolean(item.isMarketplaceApproved) ??
    normalizeBoolean(item.googleMerchantApproved);

  if (explicitApproval !== null) return explicitApproval;

  const approvalStatuses = [
    item.marketplaceApprovalStatus,
    item.googleMerchantApprovalStatus,
    item.approvalStatus,
    item.verificationStatus,
  ].map(normalizeStatus).filter(Boolean);

  if (approvalStatuses.some((status) => ['approved', 'verified', 'active', 'accepted'].includes(status))) return true;
  if (approvalStatuses.some((status) => ['pending', 'review', 'manual_review', 'rejected', 'blocked', 'suspended'].includes(status))) return false;

  return isTrue(item.verified);
}

function isPublicVisible(item: PublicListing): boolean {
  if (!isApprovedStore(item)) return false;
  if (normalizeStatus(item.storeStatus) && normalizeStatus(item.storeStatus) !== 'active') return false;
  if (isFalse(item.eligibleForBuy)) return false;
  if (isTrue(item.buyOptOut)) return false;
  if (isTrue(item.deleted) || isTrue(item.isDeleted)) return false;
  if (isTrue(item.hidden) || isTrue(item.isHidden)) return false;
  if (isFalse(item.visible) || isFalse(item.isVisible)) return false;
  if (isFalse(item.isPublished) || isFalse(item.isMarketplaceVisible)) return false;
  if (normalizeStatus(item.status) === 'draft' && !isTrue(item.isPublished)) return false;
  return true;
}

function decodeImageValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(decodeImageValues);
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.flatMap(decodeImageValues);
    } catch {
      return [trimmed];
    }
  }
  return [trimmed];
}

function normalizeImageUrl(value: string): string {
  const trimmed = value.trim().replace(/^['"]+|['"]+$/g, '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  if (!trimmed.toLowerCase().startsWith('gs://')) return trimmed;
  const withoutPrefix = trimmed.slice(5);
  const slashIndex = withoutPrefix.indexOf('/');
  if (slashIndex === -1) return '';
  return `https://storage.googleapis.com/${withoutPrefix.slice(0, slashIndex)}/${withoutPrefix.slice(slashIndex + 1)}`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !PLACEHOLDER_IMAGE_HOSTS.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function getImageUrl(item: PublicListing): string | null {
  const candidates = [item.imageUrls, item.imageUrl, item.image, item.thumbnailUrl, item.photoUrl, item.images]
    .flatMap(decodeImageValues)
    .map(normalizeImageUrl)
    .filter(isValidHttpUrl);
  return Array.from(new Set(candidates))[0] ?? null;
}

function getProductName(item: PublicListing): string {
  return compactText(item.productName ?? item.name, 'Sedifex Market item');
}

function getProductDescription(item: PublicListing): string {
  const name = getProductName(item);
  const storeName = compactText(item.storeName, 'Sedifex Market');
  const description = compactText(item.description);
  return truncate(description || `${name} from ${storeName}. Order securely through Sedifex Market.`, 5000);
}

function getProductId(item: PublicListing): string {
  return compactText(item.productId || item.id).replace(/\s+/g, '-');
}

function getItemLink(item: PublicListing): string {
  const href = getProductHref(item.id, getProductName(item), 'product');
  return `${SITE_URL}${href}`;
}

function getProductCategory(item: PublicListing): string {
  return compactText(item.categoryName ?? item.category ?? item.categoryKey, 'General');
}

function feedItem(item: PublicListing): string | null {
  const title = getProductName(item);
  const price = typeof item.price === 'number' && Number.isFinite(item.price) ? item.price : null;
  const imageUrl = getImageUrl(item);

  if (!title || !price || price <= 0 || !imageUrl) return null;

  const currency = compactText(item.currency, 'GHS').toUpperCase();
  const availability = typeof item.stockCount === 'number' && item.stockCount <= 0 ? 'out_of_stock' : 'in_stock';
  const brand = compactText(item.storeName, 'Sedifex Market');
  const sku = compactText(item.sku || item.barcode || item.manufacturerName || getProductId(item));

  return [
    '    <item>',
    `      <g:id>${xml(getProductId(item))}</g:id>`,
    `      <g:title>${xml(truncate(title, 150))}</g:title>`,
    `      <g:description>${xml(getProductDescription(item))}</g:description>`,
    `      <g:link>${xml(getItemLink(item))}</g:link>`,
    `      <g:image_link>${xml(imageUrl)}</g:image_link>`,
    `      <g:availability>${availability}</g:availability>`,
    `      <g:price>${price.toFixed(2)} ${xml(currency)}</g:price>`,
    '      <g:condition>new</g:condition>',
    `      <g:brand>${xml(truncate(brand, 70))}</g:brand>`,
    `      <g:mpn>${xml(truncate(sku, 70))}</g:mpn>`,
    '      <g:identifier_exists>false</g:identifier_exists>',
    `      <g:product_type>${xml(truncate(getProductCategory(item), 750))}</g:product_type>`,
    '    </item>',
  ].join('\n');
}

async function loadListings(): Promise<PublicListing[]> {
  if (!db) throw new Error(firebaseConfigError ?? 'Firebase is not configured.');

  const byId = new Map<string, PublicListing>();

  for (const collectionName of MARKETPLACE_COLLECTIONS) {
    const snapshot = await getDocs(query(collection(db, collectionName), limit(FEED_LIMIT_PER_COLLECTION)));
    snapshot.docs.forEach((documentSnapshot) => {
      const item = { id: documentSnapshot.id, ...documentSnapshot.data() } as PublicListing;
      const key = item.productId ? `${item.storeId ?? ''}:${item.productId}` : item.id;
      if (!byId.has(key)) byId.set(key, item);
    });
  }

  return Array.from(byId.values())
    .filter(isPhysicalProduct)
    .filter(isPublicVisible)
    .sort((left, right) => getProductName(left).localeCompare(getProductName(right)));
}

function buildFeed(items: PublicListing[]): string {
  const productItems = items.map(feedItem).filter((item): item is string => Boolean(item));
  const generatedAt = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n  <channel>\n    <title>Sedifex Market Approved Product Feed</title>\n    <link>${SITE_URL}</link>\n    <description>Approved physical products from verified Sedifex Market stores. Generated ${xml(generatedAt)}.</description>\n${productItems.join('\n')}\n  </channel>\n</rss>\n`;
}

export async function GET() {
  try {
    const listings = await loadListings();
    const feed = buildFeed(listings);

    return new NextResponse(feed, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=900, s-maxage=900, stale-while-revalidate=3600',
        'X-Robots-Tag': 'index, follow',
      },
    });
  } catch (error) {
    console.error('[google-merchant-feed] failed to build feed', error);
    const feed = buildFeed([]);
    return new NextResponse(feed, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  }
}
