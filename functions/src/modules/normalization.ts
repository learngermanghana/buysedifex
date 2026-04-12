import { readFirstNumber, readFirstString, readFirstStringArray, toTitleCase } from '../shared/normalization';
import { type NormalizedProduct, type ProductDoc, type StoreDoc } from './types';

export { normalizeCategory, normalizeText, normalizeWhatsAppNumber, toTitleCase } from '../shared/normalization';

export function normalizeStore(store: StoreDoc): StoreDoc {
  const source = store as Record<string, unknown>;

  return {
    ...store,
    name: readFirstString(source, ['name', 'storeName', 'title']),
    slug: readFirstString(source, ['slug', 'storeSlug']),
    whatsappNumber:
      readFirstString(source, ['whatsappNumber', 'whatsAppNumber']) ??
      readFirstString(source, ['storePhone', 'phone', 'telephone', 'mobile']),
    phone: readFirstString(source, ['storePhone', 'phone', 'telephone', 'mobile']),
    logoUrl: readFirstString(source, ['logoUrl', 'storeLogoUrl']),
    bannerUrl: readFirstString(source, ['bannerUrl', 'storeBannerUrl']),
    category: readFirstString(source, ['category', 'categoryKey', 'department']),
    city: readFirstString(source, ['city', 'storeCity', 'town']),
    country: readFirstString(source, ['country', 'storeCountry']),
    addressLine1: readFirstString(source, ['addressLine1', 'address', 'location']),
  };
}

export function normalizeProduct(product: ProductDoc): NormalizedProduct {
  const source = product as Record<string, unknown>;
  return {
    ...product,
    storeId: readFirstString(source, ['storeId', 'storeID', 'store_id', 'shopId', 'shop_id', 'merchantId', 'merchant_id']),
    itemType: readFirstString(source, ['itemType', 'item_type', 'type', 'kind']) ?? 'product',
    shopLink: readFirstString(source, ['shopLink', 'shopURL', 'shopUrl', 'url', 'link']) ?? null,
    name: toTitleCase(readFirstString(source, ['name', 'productName', 'product_name', 'title', 'itemName'])) ?? undefined,
    slug: readFirstString(source, ['slug', 'productSlug', 'product_slug']),
    description: readFirstString(source, ['description', 'desc', 'details', 'productDescription']),
    category: readFirstString(source, ['category', 'categoryKey', 'productCategory', 'department']),
    imageUrl: readFirstString(source, ['imageUrl', 'imageURL', 'image', 'photoUrl', 'thumbnailUrl']) ?? null,
    imageUrls: readFirstStringArray(source, ['imageUrls', 'imageURLs', 'images', 'gallery', 'photoUrls']) ?? product.imageUrls,
    price: readFirstNumber(source, ['price', 'productPrice', 'amount', 'unitPrice', 'sellingPrice', 'salePrice']),
    currency: readFirstString(source, ['currency', 'currencyCode', 'moneyCurrency']),
    featuredRank: readFirstNumber(source, ['featuredRank', 'featureRank', 'priority']),
  };
}
