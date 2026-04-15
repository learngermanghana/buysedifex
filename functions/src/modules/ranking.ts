import { type ProductDoc, type StoreDoc } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const timestampToMillis = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  if ('toMillis' in value && typeof value.toMillis === 'function') {
    try {
      const millis = value.toMillis();
      return Number.isFinite(millis) ? millis : null;
    } catch {
      return null;
    }
  }
  return null;
};

export function computeRankingScore(store: StoreDoc, product: ProductDoc): number {
  const now = Date.now();
  const featuredRank = typeof product.featuredRank === 'number' ? product.featuredRank : 0;
  const verifiedBoost = store.verified === true || store.verified === 'true' ? 25 : 0;
  const stockBoost = typeof product.stockCount === 'number' ? clamp(product.stockCount, 0, 15) : 0;
  const imageBoost = Array.isArray(product.imageUrls) ? clamp(product.imageUrls.length * 2, 0, 8) : product.imageUrl ? 2 : 0;

  const priceSignal = typeof product.price === 'number' && product.price > 0
    ? clamp(20 - Math.log10(product.price + 1) * 7, 0, 20)
    : 0;

  const updatedAtMillis = timestampToMillis(product.updatedAt) ?? timestampToMillis(product.createdAt);
  const ageDays = updatedAtMillis ? Math.max(0, (now - updatedAtMillis) / (1000 * 60 * 60 * 24)) : 45;
  const recencyBoost = clamp(30 - ageDays * 0.5, 0, 30);

  const itemTypeBoost = product.itemType === 'product' ? 5 : 2;
  const score = featuredRank * 10 + verifiedBoost + stockBoost + imageBoost + priceSignal + recencyBoost + itemTypeBoost;
  return Number(score.toFixed(2));
}
