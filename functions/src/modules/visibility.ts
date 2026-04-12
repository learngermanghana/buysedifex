import { normalizeText, normalizeWhatsAppNumber } from './normalization';
import { type NormalizedProduct, type StoreDoc } from './types';

export function buildWhatsAppLink(input: {
  phone?: string | null;
  storeName?: string | null;
  productName?: string | null;
  productId: string;
  storeId: string;
}): string | null {
  const phone = normalizeWhatsAppNumber(input.phone);
  if (!phone) return null;

  const productLabel = normalizeText(input.productName) ?? 'this product';
  const storeLabel = normalizeText(input.storeName) ?? 'your store';
  const message = `Hi! I'm interested in ${productLabel} from ${storeLabel}. (productId=${input.productId}, storeId=${input.storeId})`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function resolveStorePhone(store: StoreDoc): string | null {
  return normalizeText(store.whatsappNumber) ?? normalizeText(store.storePhone) ?? normalizeText(store.phone) ?? normalizeText(store.telephone);
}

export function withStoreDefaults(store: StoreDoc): StoreDoc {
  return {
    ...store,
    eligibleForBuy: store.eligibleForBuy ?? true,
    buyOptOut: store.buyOptOut ?? false,
  };
}

export function getEffectiveStoreStatus(store: StoreDoc): string | null {
  return store.storeStatus ?? store.status ?? null;
}

export function isStoreBuyVisible(store: StoreDoc): boolean {
  return getEffectiveStoreStatus(store) === 'active' && store.eligibleForBuy === true && store.buyOptOut === false;
}

export function isVisibleProduct(product: NormalizedProduct): boolean {
  const itemType = normalizeText(product.itemType);
  return (itemType === 'product' || itemType === 'service') && typeof product.name === 'string' && product.name.trim().length > 0;
}

export function computeVisibility(store: StoreDoc, product: NormalizedProduct): boolean {
  return isStoreBuyVisible(store) && isVisibleProduct(product);
}

export function publicProductId(storeId: string, productId: string): string {
  return `${storeId}_${productId}`;
}
